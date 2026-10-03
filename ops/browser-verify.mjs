// Uses the existing VPS Playwright installation; creates no production content.
import {createRequire} from 'node:module';
const require=createRequire(process.env.SN_PLAYWRIGHT_PACKAGE);
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto('http://127.0.0.1:8401');await page.waitForSelector('[data-action=review][data-id="4"]');
 await page.locator('[data-action=review][data-id="4"]').click();await page.waitForSelector('#reviewDialog[open]');
 if(await page.locator('[data-action=assign-slot]').count()){await page.locator('[data-action=assign-slot]').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));}
 await page.locator('[name=factsEvidence]').fill('https://independent.example/fixture-interview\nAn independent fixture confirms the claim.');await page.locator('[name=factsVerified]').check();
 await page.locator('#reviewForm button[type=submit]').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
 await page.locator('input[data-scene-id="4"]').setInputFiles('/home/ubuntu/workspace/silent-narratives-audit-20261003/stage/work/_testfiles/scene-fixture.mp4');await page.waitForFunction(()=>!document.body.classList.contains('busy'));
 await page.locator('[name=sceneEvidence]').fill('Fixture film at 00:00:00: the synthetic pattern and tone match.');await page.locator('[name=sceneVerified]').check();await page.locator('#reviewForm button[type=submit]').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
 await page.locator('[data-action=render]').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'),{},{timeout:45000});await page.waitForSelector('#reviewPreview video');
 const approvalBefore=await page.locator('[data-action=approve-schedule]').isDisabled();await page.locator('#reviewed').check();const approvalAfter=await page.locator('[data-action=approve-schedule]').isEnabled();
 await page.screenshot({path:'../evidence/06-stage-render-review-mobile.jpg'});
 await page.locator('#reviewDialog [data-action=close]').click();await page.locator('[data-action=settings]').first().click();await page.locator('#settingsForm [name=minViews]').fill('6000000');await page.locator('#settingsForm button').click();await page.waitForFunction(()=>!document.body.classList.contains('busy'));
 console.log(JSON.stringify({mobile:{width:390,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)},renderPreview:true,approvalBefore,approvalAfter,settingsSaveEnabled:await page.locator('#settingsForm button').isEnabled(),errors}));
 if(errors.length||!approvalBefore||!approvalAfter)throw new Error('Browser verification failed.');
}finally{await browser.close();}
