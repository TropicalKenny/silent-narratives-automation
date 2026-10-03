#!/usr/bin/env python3
"""Supervise an isolated Cloudflare Quick Tunnel and record its current public URL."""
import pathlib, re, signal, sqlite3, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
command=['docker','run','--rm','--name','silent-narratives-cloudflare','--network','host','--cap-drop','ALL','--security-opt','no-new-privileges','cloudflare/cloudflared:latest','tunnel','--no-autoupdate','--protocol','http2','--url','http://127.0.0.1:8400']
child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
def stop(signum,frame):
    child.terminate()
signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
seen=''
for line in child.stdout:
    match=re.search(r'https://[a-z0-9-]+\.trycloudflare\.com',line)
    if match and match.group()!=seen:
        seen=match.group()
        with sqlite3.connect(root/'data/silent-narratives.db',timeout=20) as db:
            db.execute("INSERT INTO app_settings(key,value) VALUES('public_base_url',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(seen,))
        print('Cloudflare public URL: '+seen,flush=True)
    elif 'Registered tunnel connection' in line or 'ERR' in line:
        print(line.rstrip(),flush=True)
sys.exit(child.wait() or 1)
