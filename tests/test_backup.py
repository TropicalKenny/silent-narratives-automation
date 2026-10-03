import hashlib,json,pathlib,sqlite3,subprocess,sys,tarfile,tempfile,time,unittest
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'ops'))
from backup import create_backup
from drive_backup import deliver,private

class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name)
        for name in ['data','assets','src','work/1']:(self.root/name).mkdir(parents=True)
        self.key=self.root/'recovery.pem';self.cert=self.root/'data/backup-recipient.pem'
        subprocess.run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048','-out',str(self.key)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        subprocess.run(['openssl','req','-new','-x509','-key',str(self.key),'-out',str(self.cert),'-days','1','-subj','/CN=Fixture'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        (self.root/'data/secrets.json').write_text(json.dumps({'fixture_secret':'never_plaintext_off_vps'}))
        (self.root/'assets/background.mp4').write_bytes(b'fixed-gameplay')
        (self.root/'assets/channel-avatar.jpg').write_bytes(b'fixed-avatar')
        (self.root/'src/server.js').write_text('fixture source')
        (self.root/'work/1/scene.mp4').write_bytes(b'pending-scene')
        with sqlite3.connect(self.root/'data/silent-narratives.db') as db:
            db.execute('CREATE TABLE jobs(id INTEGER,scene_file TEXT,render_file TEXT,preview_file TEXT,upload_confirmed_at TEXT)')
            db.execute('INSERT INTO jobs VALUES(1,?,NULL,NULL,NULL)',(str(self.root/'work/1/scene.mp4'),))
            db.execute('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT)')
    def tearDown(self):self.temp.cleanup()
    def test_encrypted_bundle_restores_db_assets_pending_media_and_all_hashes(self):
        result=create_backup(self.root);self.assertNotIn(b'never_plaintext_off_vps',result['file'].read_bytes())
        restored=self.root/'restored.tar.gz'
        subprocess.run(['openssl','cms','-decrypt','-binary','-inform','DER','-inkey',str(self.key),'-recip',str(self.cert),'-in',str(result['file']),'-out',str(restored)],check=True,capture_output=True)
        with tarfile.open(restored) as archive:
            manifest=json.load(archive.extractfile('manifest.json'))
            for name,digest in manifest['files'].items():self.assertEqual(hashlib.sha256(archive.extractfile(name).read()).hexdigest(),digest)
            self.assertNotIn('recovery.pem',archive.getnames())
            self.assertEqual(archive.extractfile('assets/background.mp4').read(),b'fixed-gameplay')
            self.assertEqual(archive.extractfile('work/1/scene.mp4').read(),b'pending-scene')
        self.assertEqual(result['databaseRestoreCheck'],'ok');self.assertEqual(result['file'].stat().st_mode&0o777,0o600)
        damaged=self.root/'damaged.cms';content=bytearray(result['file'].read_bytes());content[-25]^=1;damaged.write_bytes(content)
        self.assertNotEqual(subprocess.run(['openssl','cms','-decrypt','-binary','-inform','DER','-inkey',str(self.key),'-recip',str(self.cert),'-in',str(damaged),'-out',str(self.root/'bad.tar.gz')],capture_output=True).returncode,0)
    def test_missing_recipient_fails_and_no_drive_consent_makes_no_network_call(self):
        result=create_backup(self.root)
        with patch('drive_backup.request',side_effect=AssertionError('No network allowed')):self.assertEqual(deliver(self.root,result)['offVps'],'awaiting_authorization')
        self.cert.unlink()
        with self.assertRaisesRegex(RuntimeError,'recipient'):create_backup(self.root)
    def test_restore_helper_places_runtime_recipient_and_refuses_to_overwrite_live_files(self):
        result=create_backup(self.root);destination=self.root/'restored-app'
        helper=pathlib.Path(__file__).resolve().parents[1]/'ops/restore-backup.py'
        command=[sys.executable,str(helper),str(result['file']),'--key',str(self.key),'--destination',str(destination)]
        completed=subprocess.run(command,check=True,capture_output=True,text=True)
        self.assertTrue(json.loads(completed.stdout)['extracted'])
        self.assertEqual((destination/'data/backup-recipient.pem').read_bytes(),self.cert.read_bytes())
        self.assertEqual((destination/'data/secrets.json').stat().st_mode&0o777,0o600)
        self.assertFalse((destination/'recovery.pem').exists())
        self.assertNotEqual(subprocess.run(command,capture_output=True).returncode,0)
    def test_external_destination_must_be_private(self):
        private({'permissions':[{'type':'user','role':'owner'}]})
        for permissions in [[],[{'type':'anyone','role':'reader'}],[{'type':'user','role':'owner'},{'type':'user','role':'writer'}]]:
            with self.assertRaisesRegex(RuntimeError,'private'):private({'permissions':permissions})
    def test_saved_drive_transfer_resumes_and_readback_confirms_size_privacy(self):
        result=create_backup(self.root)
        (self.root/'data/secrets.json').write_text(json.dumps({'youtube_oauth_scopes':'https://www.googleapis.com/auth/drive.file','youtube_access_token':'fixture','youtube_access_expiry':str((time.time()+3600)*1000)}))
        with sqlite3.connect(self.root/'data/silent-narratives.db') as db:db.execute("INSERT INTO app_settings VALUES('backup_drive_folder_id','fixture-folder')")
        ticket=result['target']/'drive-upload.json';ticket.write_text(json.dumps({'session':'https://www.googleapis.com/upload/fixture','sha256':result['sha256']}))
        calls=[]
        def mocked(url,method='GET',body=None,headers=None,timeout=30):
            calls.append((url,method,headers))
            if '/fixture-folder?' in url:return {'id':'fixture-folder','permissions':[{'type':'user','role':'owner'}]}, {},200
            if '/upload/fixture' in url:
                if headers['Content-Range'].startswith('bytes */'):return {},{'Range':'bytes=0-9'},308
                self.assertTrue(headers['Content-Range'].startswith('bytes 10-'));return {'id':'fixture-copy'}, {},200
            if '/fixture-copy?' in url:return {'id':'fixture-copy','size':str(result['bytes']),'permissions':[{'type':'user','role':'owner'}]}, {},200
            if '?q=' in url:return {'files':[]},{},200
            self.fail('Unexpected request')
        with patch('drive_backup.request',side_effect=mocked):self.assertEqual(deliver(self.root,result)['offVps'],'verified')
        self.assertFalse(any(method=='POST' for _,method,_ in calls));self.assertFalse(ticket.exists())

if __name__=='__main__':unittest.main()
