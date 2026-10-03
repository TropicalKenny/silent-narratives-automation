"""Deliver encrypted bundles using optional drive.file consent on the existing OAuth client."""
import datetime,json,os,pathlib,sqlite3,urllib.request,urllib.error,urllib.parse
SCOPE='https://www.googleapis.com/auth/drive.file'

def request(url,method='GET',body=None,headers=None,timeout=30):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,method=method,headers=headers or {}),timeout=timeout) as response:
            raw=response.read();return json.loads(raw) if raw else {},dict(response.headers),response.status
    except urllib.error.HTTPError as error:
        if error.code==308:return {},dict(error.headers),308
        raise RuntimeError('Google Drive request failed (HTTP '+str(error.code)+'). Check API activation and backup permission.') from None

def private(metadata):
    permissions=metadata.get('permissions')
    if not permissions or any(item.get('role')!='owner' or item.get('type')!='user' for item in permissions):raise RuntimeError('The backup destination must be a private owner-only Drive folder.')

def deliver(root,result):
    file=root/'data/secrets.json';secrets=json.loads(file.read_text())
    if SCOPE not in secrets.get('youtube_oauth_scopes','').split():return {'offVps':'awaiting_authorization','message':'Encrypted snapshots are ready. Connect automatic Drive backups to authorize daily external delivery.'}
    import time
    token=secrets.get('youtube_access_token');expiry=float(secrets.get('youtube_access_expiry','0'))
    if not token or time.time()*1000>=expiry:
        body=urllib.parse.urlencode({'client_id':secrets.get('google_client_id',''),'client_secret':secrets.get('google_client_secret',''),'refresh_token':secrets.get('youtube_refresh_token',''),'grant_type':'refresh_token'}).encode()
        response,_,_=request('https://oauth2.googleapis.com/token','POST',body,{'Content-Type':'application/x-www-form-urlencoded'})
        token=response.get('access_token')
        if not token:raise RuntimeError('Drive access could not be refreshed.')
        current=json.loads(file.read_text());current.update({'youtube_access_token':token,'youtube_access_expiry':str(int(time.time()*1000+(response.get('expires_in',3600)-60)*1000))})
        if response.get('scope'):current['youtube_oauth_scopes']=response['scope']
        temporary=file.with_name('secrets.backup.tmp');temporary.write_text(json.dumps(current,indent=2));os.chmod(temporary,0o600);temporary.replace(file)
        if response.get('scope') and SCOPE not in response['scope'].split():raise RuntimeError('Drive backup permission is no longer granted.')
    headers={'Authorization':'Bearer '+token};base='https://www.googleapis.com/drive/v3/files'
    with sqlite3.connect(root/'data/silent-narratives.db') as db:
        value=db.execute("SELECT value FROM app_settings WHERE key='backup_drive_folder_id'").fetchone();folder=value[0] if value else None
        if not folder:
            query=urllib.parse.urlencode({'q':"mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='silentNarrativesBackup' and value='v1' }",'fields':'files(id,permissions(id,type,role))'})
            found,_,_=request(base+'?'+query,headers=headers)
            if found.get('files'):folder=found['files'][0]['id'];private(found['files'][0])
            else:
                created,_,_=request(base+'?fields=id,permissions(id,type,role)','POST',json.dumps({'name':'Silent Narratives Automatic Backups','mimeType':'application/vnd.google-apps.folder','appProperties':{'silentNarrativesBackup':'v1'}}).encode(),{**headers,'Content-Type':'application/json'})
                private(created);folder=created['id']
            db.execute("INSERT INTO app_settings(key,value) VALUES('backup_drive_folder_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(folder,))
    metadata,_,_=request(base+'/'+urllib.parse.quote(folder,safe='')+'?fields=id,permissions(id,type,role)',headers=headers);private(metadata)
    ticket=result['target']/'drive-upload.json';encrypted=result['file'];size=encrypted.stat().st_size
    query=urllib.parse.urlencode({'q':"'"+folder.replace("'","\\'")+"' in parents and trashed=false and appProperties has { key='cipherSha256' and value='"+result['sha256']+"' }",'fields':'files(id,size,permissions(id,type,role))'})
    existing,_,_=request(base+'?'+query,headers=headers)
    if existing.get('files'):
        uploaded=existing['files'][0];private(uploaded)
    else:
        session=None
        if ticket.exists():
            saved=json.loads(ticket.read_text())
            if saved.get('sha256')==result['sha256']:session=saved.get('session')
        if not session:
            metadata={'name':'silent-narratives-'+result['target'].name+'.tar.gz.cms','parents':[folder],'appProperties':{'cipherSha256':result['sha256'],'silentNarrativesBackup':'v1'}}
            _,response_headers,_=request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,permissions(id,type,role)','POST',json.dumps(metadata).encode(),{**headers,'Content-Type':'application/json','X-Upload-Content-Type':'application/octet-stream','X-Upload-Content-Length':str(size)})
            session=response_headers.get('Location') or response_headers.get('location')
            if not session:raise RuntimeError('Google Drive did not provide an upload session.')
            temporary=ticket.with_suffix('.tmp');temporary.write_text(json.dumps({'session':session,'sha256':result['sha256']}));os.chmod(temporary,0o600);temporary.replace(ticket)
        parsed=urllib.parse.urlparse(session)
        if parsed.scheme!='https' or parsed.hostname not in ['www.googleapis.com','content.googleapis.com']:raise RuntimeError('Unexpected Drive upload destination.')
        uploaded,status_headers,status=request(session,'PUT',b'',{**headers,'Content-Length':'0','Content-Range':'bytes */'+str(size)})
        offset=int((status_headers.get('Range') or status_headers.get('range')).split('-')[-1])+1 if status==308 and ('Range' in status_headers or 'range' in status_headers) else 0
        if status==308:
            with encrypted.open('rb') as stream:
                stream.seek(offset)
                while offset<size:
                    chunk=stream.read(min(8*1024*1024,size-offset))
                    uploaded,_,status=request(session,'PUT',chunk,{**headers,'Content-Type':'application/octet-stream','Content-Length':str(len(chunk)),'Content-Range':'bytes '+str(offset)+'-'+str(offset+len(chunk)-1)+'/'+str(size)},timeout=120)
                    offset+=len(chunk)
                    if status not in [200,201,308]:raise RuntimeError('Drive transfer was not confirmed.')
        if status not in [200,201] or not uploaded.get('id'):raise RuntimeError('Drive did not confirm the completed upload.')
        uploaded,_,_=request(base+'/'+urllib.parse.quote(uploaded['id'],safe='')+'?fields=id,size,permissions(id,type,role)',headers=headers)
        private(uploaded)
    if int(uploaded.get('size','-1'))!=size:raise RuntimeError('Drive size does not match the encrypted snapshot.')
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    receipt={'fileId':uploaded['id'],'sha256':result['sha256'],'bytes':size,'verifiedAt':now,'private':True}
    (result['target']/'drive-copy-receipt.json').write_text(json.dumps(receipt,indent=2));os.chmod(result['target']/'drive-copy-receipt.json',0o600)
    ticket.unlink(missing_ok=True)
    return {'offVps':'verified','lastOffVps':now,'message':'Encrypted backup uploaded to private Google Drive and verified by size and owner-only permissions.'}
