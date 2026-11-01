import hashlib
import os
import sys
import json
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHECKOUT = Path(sys.argv[1]).resolve()
PNPM = 'pnpm.cmd' if os.name == 'nt' else 'pnpm'
NPM = 'npm.cmd' if os.name == 'nt' else 'npm'
SOURCE = CHECKOUT / 'packages/shared/src/normalizeProp.ts'
CANDIDATE = SOURCE.read_bytes()
PACKAGES = [p.parent for p in (CHECKOUT / 'packages').glob('*/package.json')
            if not json.loads(p.read_text()).get('private')]


def run(command, cwd, log):
    with log.open('wb') as output:
        result = subprocess.run(command, cwd=cwd, stdout=output, stderr=subprocess.STDOUT)
    return result.returncode


def pack_and_prove(label):
    destination = ROOT / ('packed-review-' + label)
    destination.mkdir(exist_ok=True)
    dependencies = {}
    contents = []
    for package in PACKAGES:
        code = run([PNPM, '--dir', str(package), 'pack',
                    '--pack-destination', str(destination), '--json'], CHECKOUT,
                   destination / (package.name + '.log'))
        assert code == 0, (label, package.name, code)
    for archive in destination.glob('*.tgz'):
        with tarfile.open(archive) as tar:
            manifest = json.load(tar.extractfile('package/package.json'))
            name = manifest['name']
            package = next(p for p in PACKAGES if json.loads((p/'package.json').read_text())['name'] == name)
            dependencies[name] = 'file:' + archive.as_posix()
            for member in tar.getmembers():
                if member.isfile() and member.name != 'package/package.json':
                    relative = member.name.removeprefix('package/')
                    payload = tar.extractfile(member).read()
                    assert payload == (package / relative).read_bytes(), (label, name, relative)
                    contents.append({'package': name, 'path': relative,
                                     'sha256': hashlib.sha256(payload).hexdigest()})
    consumer = ROOT / ('consumer-review-' + label)
    consumer.mkdir(exist_ok=True)
    (consumer / 'package.json').write_text(json.dumps({'name': 'vue-css-block-consumer',
        'version': '1.0.0', 'private': True, 'dependencies': dependencies}, indent=2))
    (destination / 'contents-verified.json').write_text(json.dumps(contents, indent=2))
    code = run([NPM, 'install', '--ignore-scripts', '--no-audit', '--no-fund'],
               consumer, consumer / 'install.log')
    assert code == 0, (label, 'install', code)
    code = run(['node', str(ROOT / 'packed-consumer-proof.cjs'), str(consumer), str(CHECKOUT)],
               CHECKOUT, consumer / 'proof.log')
    result = json.loads((consumer / 'proof-native-result.json').read_text())
    return {'variant': label, 'proofExit': code, 'passed': result['passed'],
            'total': result['total'], 'verifiedPackedFiles': len(contents)}


records = []
try:
    # Build every arm with declarations using the same command.
    code = run([PNPM, 'run', 'build', '--withTypes'], CHECKOUT, ROOT / 'candidate-build-v2.log')
    assert code == 0, ('candidate build', code)
    records.append(pack_and_prove('candidate'))
    print(records[-1], flush=True)
    for label, revision in [('before', 'b4c0ef322ddd3be40ff760c97d44a8ee8bc3037a')]:
        SOURCE.write_bytes(subprocess.check_output(['git', 'show', revision +
            ':packages/shared/src/normalizeProp.ts'], cwd=CHECKOUT))
        code = run([PNPM, 'run', 'build', '--withTypes'], CHECKOUT, ROOT / (label + '-build-v2.log'))
        assert code == 0, (label, 'build', code)
        records.append(pack_and_prove(label))
        print(records[-1], flush=True)
finally:
    SOURCE.write_bytes(CANDIDATE)
    # Keep the working tree's ignored artifacts on the candidate too.
    code = run([PNPM, 'run', 'build', '--withTypes'], CHECKOUT, ROOT / 'candidate-restored-build-v2.log')
    assert code == 0, ('candidate restore build', code)
    (ROOT / 'packed-review-summary-native.json').write_text(json.dumps(records, indent=2))
