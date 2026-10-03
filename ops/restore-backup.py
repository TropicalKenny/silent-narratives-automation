#!/usr/bin/env python3
"""Verify an encrypted recovery bundle; optionally extract into a NEW empty directory."""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,tarfile,tempfile
parser=argparse.ArgumentParser()
parser.add_argument('backup',type=pathlib.Path)
parser.add_argument('--key',required=True,type=pathlib.Path)
parser.add_argument('--destination',type=pathlib.Path)
args=parser.parse_args()
os.umask(0o077)
with tempfile.TemporaryDirectory(prefix='sn-recovery-') as scratch:
    archive=pathlib.Path(scratch)/'recovery.tar.gz'
    result=subprocess.run(['openssl','cms','-decrypt','-binary','-inform','DER','-inkey',str(args.key),'-in',str(args.backup),'-out',str(archive)],capture_output=True)
    if result.returncode:raise SystemExit('Decryption/authentication failed. Nothing was restored.')
    with tarfile.open(archive) as bundle:
        manifest=json.load(bundle.extractfile('manifest.json'))
        if manifest.get('format')!='silent-narratives-recovery-v1':raise SystemExit('Unknown recovery format.')
        if set(bundle.getnames())!=set(manifest['files'])|{'manifest.json'}:raise SystemExit('Archive members do not match the manifest.')
        for name,digest in manifest['files'].items():
            path=pathlib.PurePosixPath(name)
            if path.is_absolute() or '..' in path.parts:raise SystemExit('Unsafe archive path.')
            member=bundle.getmember(name)
            if not member.isfile():raise SystemExit('Recovery members must be regular files.')
            stream=bundle.extractfile(member);check=hashlib.sha256()
            for chunk in iter(lambda:stream.read(1024*1024),b''):check.update(chunk)
            if check.hexdigest()!=digest:raise SystemExit('Recovery hash mismatch.')
        if args.destination:
            destination=args.destination.resolve()
            if destination.exists() and any(destination.iterdir()):raise SystemExit('Choose a new empty destination; live files will not be overwritten.')
            destination.mkdir(mode=0o700,parents=True,exist_ok=True)
            bundle.extractall(destination,filter='data')
            if (destination/'data').exists():os.chmod(destination/'data',0o700)
            # Recovery v1 bundles carry the public certificate at their root.
            # Restore its runtime location without changing the verified original.
            certificate=destination/'backup-recipient.pem'
            runtime_certificate=destination/'data/backup-recipient.pem'
            if certificate.is_file() and not runtime_certificate.exists():
                runtime_certificate.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
                shutil.copyfile(certificate,runtime_certificate)
                os.chmod(runtime_certificate,0o600)
            for name in ['data/secrets.json','data/silent-narratives.db','data/.app-key']:
                path=destination/name
                if path.exists():os.chmod(path,0o600)
    print(json.dumps({'decryption':'authenticated','fileHashes':'verified','files':len(manifest['files']),'createdAt':manifest['createdAt'],'extracted':bool(args.destination)}))
