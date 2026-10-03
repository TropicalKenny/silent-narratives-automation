#!/usr/bin/env python3
"""Consistent recovery bundle, public-key encryption, optional private Drive delivery."""
import datetime,fcntl,hashlib,json,os,pathlib,shutil,sqlite3,subprocess,tarfile,tempfile
from drive_backup import deliver

def atomic_json(path,value):
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,indent=2)+'\n');os.chmod(temporary,0o600)
    temporary.replace(path)

def digest(path):
    result=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):result.update(chunk)
    return result.hexdigest()

def create_backup(root):
    root=pathlib.Path(root).resolve();backup_root=root/'backups'
    backup_root.mkdir(mode=0o700,exist_ok=True);os.chmod(backup_root,0o700)
    recipient=root/'data/backup-recipient.pem'
    if not recipient.is_file():raise RuntimeError('Configure the public backup recipient certificate before creating encrypted snapshots.')
    now=datetime.datetime.now(datetime.timezone.utc)
    target=backup_root/now.strftime('%Y%m%dT%H%M%S.%fZ');target.mkdir(mode=0o700)
    try:
        with sqlite3.connect(root/'data/silent-narratives.db') as source,sqlite3.connect(target/'silent-narratives.db') as copy:
            source.backup(copy)
            if copy.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise RuntimeError('Database backup integrity check failed.')
            count=copy.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]
            media=copy.execute('SELECT scene_file,render_file,preview_file FROM jobs WHERE upload_confirmed_at IS NULL').fetchall()
        os.chmod(target/'silent-narratives.db',0o600)
        credentials=(root/'data/secrets.json').read_bytes();json.loads(credentials)
        (target/'secrets.json').write_bytes(credentials);os.chmod(target/'secrets.json',0o600)
        files={'data/silent-narratives.db':target/'silent-narratives.db','data/secrets.json':target/'secrets.json','backup-recipient.pem':recipient}
        for name in ['src','public','config','ops','tests']:
            directory=root/name
            if directory.is_dir():
                for path in directory.rglob('*'):
                    if path.is_file() and not path.is_symlink() and '__pycache__' not in path.parts and path.suffix!='.pyc':files[path.relative_to(root).as_posix()]=path
        for name in ['package.json','package-lock.json','README.md','HANDOFF.md','.gitignore','assets/background.mp4','assets/channel-avatar.jpg','data/.app-key']:
            path=root/name
            if path.is_file() and not path.is_symlink():files[name]=path
        if (root/'docs').is_dir():
            for path in (root/'docs').rglob('*.md'):
                if path.is_file() and not path.is_symlink():files[path.relative_to(root).as_posix()]=path
        for row in media:
            for name in row:
                if not name:continue
                path=pathlib.Path(name);path=path if path.is_absolute() else root/path
                if path.is_symlink():raise RuntimeError('Pending media must not be a symbolic link.')
                path=path.resolve()
                if not path.is_relative_to(root/'work'):raise RuntimeError('Pending media is outside the project work directory.')
                if path.is_file():files[path.relative_to(root).as_posix()]=path
        hashes={name:digest(path) for name,path in files.items()}
        manifest={'format':'silent-narratives-recovery-v1','createdAt':now.isoformat(),'jobs':count,'files':hashes,'encryption':'OpenSSL CMS AES-256-GCM; separate RSA recovery key'}
        atomic_json(target/'manifest.json',manifest)
        with tempfile.TemporaryDirectory(prefix='sn-encrypt-',dir=backup_root) as scratch:
            os.chmod(scratch,0o700);archive=pathlib.Path(scratch)/'recovery.tar.gz'
            with tarfile.open(archive,'w:gz') as bundle:
                for name,path in sorted(files.items()):bundle.add(path,arcname=name,recursive=False)
                bundle.add(target/'manifest.json',arcname='manifest.json')
            for name,path in files.items():
                if digest(path)!=hashes[name]:raise RuntimeError('A source file changed during backup. Retry when the operation completes.')
            encrypted=target/'recovery.tar.gz.cms'
            result=subprocess.run(['openssl','cms','-encrypt','-binary','-aes-256-gcm','-outform','DER','-in',str(archive),'-out',str(encrypted),str(recipient)],capture_output=True)
            if result.returncode:raise RuntimeError('Public-key backup encryption failed.')
            os.chmod(encrypted,0o600)
            restored=pathlib.Path(scratch)/'restored.db';shutil.copyfile(target/'silent-narratives.db',restored)
            with sqlite3.connect(restored) as check:
                if check.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise RuntimeError('Separate database restore check failed.')
        for old in sorted((x for x in backup_root.iterdir() if x.is_dir() and x.name[:8].isdigit()),reverse=True)[7:]:shutil.rmtree(old)
        return {'target':target,'file':encrypted,'createdAt':now.isoformat(),'sha256':digest(encrypted),'jobs':count,'databaseRestoreCheck':'ok','bytes':encrypted.stat().st_size}
    except Exception:
        shutil.rmtree(target,ignore_errors=True)
        raise

def run(root):
    root=pathlib.Path(root).resolve();backup_root=root/'backups';backup_root.mkdir(mode=0o700,exist_ok=True)
    with (backup_root/'.backup.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('A backup is already running.')
        result=create_backup(root)
        status_file=root/'data/backup-status.json'
        try:status=json.loads(status_file.read_text())
        except (FileNotFoundError,json.JSONDecodeError):status={}
        status.update({'lastBackup':result['createdAt'],'encrypted':True,'databaseRestoreCheck':'ok','cipherSha256':result['sha256']})
        try:status.update(deliver(root,result))
        except Exception:status.update({'offVps':'delivery_error','message':'Encrypted local backup passed. External delivery needs attention; check Drive access and retry.'})
        atomic_json(status_file,status)
        print(json.dumps({'backup':str(result['target']),'encrypted':True,'bytes':result['bytes'],'databaseRestoreCheck':'ok','jobs':result['jobs'],'offVps':status['offVps'],'retained':7}))
        if status['offVps']=='delivery_error':raise RuntimeError(status['message'])
        return result

if __name__=='__main__':
    try:run(pathlib.Path(__file__).resolve().parents[1])
    except Exception as error:
        print(str(error),file=__import__('sys').stderr);raise SystemExit(1)
