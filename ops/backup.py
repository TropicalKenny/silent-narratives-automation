#!/usr/bin/env python3
"""Create a consistent private SQLite/credential backup; verify a separate restored copy."""
import datetime, json, os, pathlib, shutil, sqlite3, tempfile
root=pathlib.Path(__file__).resolve().parents[1]
backup_root=root/'backups'
backup_root.mkdir(mode=0o700,exist_ok=True)
os.chmod(backup_root,0o700)
name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target=backup_root/name
target.mkdir(mode=0o700)
with sqlite3.connect(root/'data/silent-narratives.db') as source, sqlite3.connect(target/'silent-narratives.db') as copy:
    source.backup(copy)
    assert copy.execute('PRAGMA quick_check').fetchone()[0]=='ok'
os.chmod(target/'silent-narratives.db',0o600)
credentials=root/'data/secrets.json'
if credentials.exists():
    json.loads(credentials.read_text())
    shutil.copyfile(credentials,target/'secrets.json')
    os.chmod(target/'secrets.json',0o600)
with tempfile.TemporaryDirectory(prefix='sn-restore-check-') as scratch:
    restored=pathlib.Path(scratch)/'restored.db'
    shutil.copyfile(target/'silent-narratives.db',restored)
    with sqlite3.connect(restored) as check:
        assert check.execute('PRAGMA quick_check').fetchone()[0]=='ok'
        count=check.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]
for old in sorted((x for x in backup_root.iterdir() if x.is_dir()),reverse=True)[7:]:
    shutil.rmtree(old)
print(json.dumps({'backup':str(target),'databaseRestoreCheck':'ok','jobs':count,'credentialCopy':credentials.exists(),'retained':7}))
