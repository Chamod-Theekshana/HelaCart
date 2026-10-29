import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Uses the existing backend's ADC, never copies server credentials to the app.
const require=createRequire(new URL('../../helacart-api/package.json',import.meta.url));
require('dotenv').config({path:fileURLToPath(new URL('../../helacart-api/.env',import.meta.url)),quiet:true});
const {applicationDefault,initializeApp,deleteApp}=require('firebase-admin/app');
const {getProjectManagement}=require('firebase-admin/project-management');
const packageName='com.helacart.buyer';
const projectId=process.env.FIREBASE_PROJECT_ID;
if(!projectId)throw Error('The existing API FIREBASE_PROJECT_ID is required.');
const app=initializeApp({credential:applicationDefault(),projectId},'helacart-buyer-configuration');
try{
  const management=getProjectManagement(app);
  const registered=await management.listAndroidApps();let android;
  for(const candidate of registered){if((await candidate.getMetadata()).packageName===packageName){android=candidate;break;}}
  let created=false;
  if(!android){
    if(!process.argv.includes('--register')){process.stdout.write(JSON.stringify({packageName,registered:false,next:'Run with --register to register this client in the existing Firebase project.'})+'\n');process.exitCode=2;}
    else{android=await management.createAndroidApp(packageName,'HelaCart Buyer');created=true;}
  }
  if(android){
    const text=await android.getConfig();const sdk=JSON.parse(text);
    const client=sdk.client?.find(c=>c.client_info?.android_client_info?.package_name===packageName);
    if(!client?.client_info?.mobilesdk_app_id||!client.api_key?.[0]?.current_key)throw Error('The registered client config is incomplete.');
    const root=new URL('../',import.meta.url);
    await fs.writeFile(new URL('android/app/google-services.json',root),text);
    await fs.mkdir(new URL('config/',root),{recursive:true});
    await fs.writeFile(new URL('config/android-dev.json',root),JSON.stringify({APP_ENV:'dev',API_URL:'http://10.0.2.2:4000/api/v1',FIREBASE_API_KEY:client.api_key[0].current_key,FIREBASE_APP_ID:client.client_info.mobilesdk_app_id,FIREBASE_MESSAGING_SENDER_ID:sdk.project_info.project_number,FIREBASE_PROJECT_ID:sdk.project_info.project_id,FIREBASE_IOS_BUNDLE_ID:packageName},null,2)+'\n');
    process.stdout.write(JSON.stringify({packageName,registered:true,created,configurationWritten:true,serverCredentialsCopied:false})+'\n');
  }
}finally{await deleteApp(app);}
