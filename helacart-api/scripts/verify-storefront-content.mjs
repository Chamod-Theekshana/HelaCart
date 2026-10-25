import 'reflect-metadata';
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '../dist/prisma/prisma.service.js';
import {AuthService} from '../dist/auth/auth.service.js';
import {CatalogService} from '../dist/catalog/catalog.service.js';
import {CategoriesAdminService} from '../dist/storefront-content/categories-admin.service.js';
import {HeroAdminService} from '../dist/storefront-content/hero-admin.service.js';
import {ContentImageStorageService} from '../dist/storefront-content/content-image-storage.service.js';
import {defaultHero} from '../dist/storefront-content/hero-content.js';
const prisma=new PrismaService(new ConfigService(process.env));
const storage=new ContentImageStorageService(new ConfigService(process.env));
const uploads=[],cleanupCalls=[];
const trackedStorage=new Proxy(storage,{get(target,key){if(key==='upload')return async(...args)=>{const result=await target.upload(...args);uploads.push(result);return result;};if(key==='cleanup')return async storageKey=>{cleanupCalls.push(storageKey);if(uploads.some(item=>item.storageKey===storageKey))await target.remove(storageKey);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
const prefix=`content-audit-${randomUUID()}`,rollback=new Error('CONTENT_AUDIT_ROLLBACK');let checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
const identity={uid:prefix,email:`${prefix}@example.com`,email_verified:true};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=','base64');
const incoming=()=>Object.assign(Readable.from([png]),{headers:{'content-type':'image/png','content-length':String(png.length)}});
await prisma.$connect();
try{
 await prisma.$transaction(async tx=>{
  const db=new Proxy(tx,{get(target,key){if(key==='$transaction')return async callback=>callback(tx);const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  const auth=new AuthService(db),catalog=new CatalogService(db,auth),categories=new CategoriesAdminService(db,trackedStorage),hero=new HeroAdminService(db,auth,trackedStorage);
  const created=await catalog.createCategory({name:prefix,slug:prefix,description:'Temporary category',sortOrder:5});
  assert.equal(created.isActive,true);assert.equal(created.imageUrl,null);assert.equal(created.revision,0);pass('Category defaults preserve existing behavior');
  const edited=await categories.update(created.id,{name:prefix+' edited',description:'Updated description',sortOrder:3,isActive:true,expectedRevision:0});
  assert.equal(edited.slug,prefix);assert.equal(edited.name,prefix+' edited');pass('Category name/description/order update without changing links');
  await assert.rejects(()=>categories.update(created.id,{name:prefix,description:'',sortOrder:0,isActive:true,expectedRevision:0}),{status:409});pass('Stale category edits are rejected');
  const withImage=await categories.image(created.id,1,incoming());assert.ok(withImage.imageUrl);assert.ok(!Object.hasOwn(withImage,'imageStorageKey'));pass('Real category image upload persists safe metadata');
  const imageResponse=await fetch(withImage.imageUrl,{signal:AbortSignal.timeout(15000)});assert.equal(imageResponse.status,200);assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),png);pass('Uploaded category image is publicly readable');
  const list=await catalog.categories();assert.equal(list.find(row=>row.id===created.id).imageUrl,withImage.imageUrl);assert.ok(!Object.hasOwn(list.find(row=>row.id===created.id),'imageStorageKey'));pass('Public categories expose the image without storage keys');
  const seller=await tx.seller.create({data:{name:'Temporary seller',slug:prefix,status:'APPROVED'}});
  const product=await tx.product.create({data:{sellerId:seller.id,categoryId:created.id,title:'Temporary product',slug:prefix,description:'Temporary audit product',sku:prefix,priceLkrMinor:10000,status:'APPROVED'}});
  await assert.rejects(()=>categories.remove(created.id,2),{status:409});pass('Categories with products cannot be deleted');
  const archived=await categories.update(created.id,{name:prefix,description:'',sortOrder:3,isActive:false,expectedRevision:2});
  assert.ok(!(await catalog.categories()).some(row=>row.id===created.id));await assert.rejects(()=>catalog.publicProduct(product.id),{status:404});assert.ok(await tx.product.findUnique({where:{id:product.id}}));pass('Archiving hides category/products while keeping records');
  const archivedPage=await categories.list({page:1,limit:20,q:prefix,availability:'archived'});assert.equal(archivedPage.total,1);assert.equal(archivedPage.items[0]._count.products,1);pass('Admin can discover archived categories and accurate product counts');
  await categories.update(created.id,{name:prefix,description:'',sortOrder:3,isActive:true,expectedRevision:archived.revision});assert.equal((await catalog.publicProduct(product.id)).id,product.id);pass('Restoring a category restores approved products');
  const removedImage=await categories.image(created.id,4);assert.equal(removedImage.imageUrl,null);assert.ok(cleanupCalls.includes(uploads[0].storageKey));pass('Removing a category image clears metadata and deletes its object');
  const empty=await tx.category.create({data:{name:'Empty audit',slug:prefix+'-empty'}});await categories.remove(empty.id,0);assert.equal(await tx.category.count({where:{id:empty.id}}),0);pass('Empty categories can be deleted');
  // All changes to the singleton occur inside this always-rolled-back transaction.
  // Start from default imagery so no customer asset can enter cleanup decisions.
  await tx.storefrontAppearance.upsert({where:{id:'home'},create:{id:'home',draft:defaultHero,published:defaultHero},update:{draft:defaultHero,published:defaultHero,revision:0,publishedAt:null,publishedByUserId:null}});
  const {desktopImageUrl:_desktop,mobileImageUrl:_mobile,...text}=defaultHero;void _desktop;void _mobile;
  await hero.update({...text,title:'Temporary draft hero',expectedRevision:0});assert.equal((await hero.publicHero()).title,defaultHero.title);pass('Draft edits do not change the published hero');
  const imageDraft=await hero.image('desktop',1,incoming());assert.ok(imageDraft.draft.desktopImageUrl);assert.equal((await hero.publicHero()).desktopImageUrl,null);pass('Hero image uploads remain in the draft');
  await hero.publish(2,identity);assert.equal((await hero.publicHero()).title,'Temporary draft hero');assert.equal((await hero.publicHero()).desktopImageUrl,imageDraft.draft.desktopImageUrl);pass('Publishing exposes saved text and imagery together');
  await assert.rejects(()=>hero.publish(2,identity),{status:409});pass('Stale publishing cannot overwrite newer content');
  const nextImage=await hero.image('desktop',3,incoming());assert.ok(!cleanupCalls.includes(uploads[1].storageKey));assert.equal((await hero.publicHero()).desktopImageUrl,imageDraft.draft.desktopImageUrl);pass('A replacement upload keeps the current live image available');
  await hero.publish(nextImage.revision,identity);assert.ok(cleanupCalls.includes(uploads[1].storageKey));assert.equal((await hero.publicHero()).desktopImageUrl,nextImage.draft.desktopImageUrl);pass('Publish switches imagery before old managed image cleanup');
  throw rollback;
 },{timeout:180000,maxWait:15000}).catch(error=>{if(error!==rollback)throw error;});
 assert.equal(await prisma.category.count({where:{slug:{startsWith:prefix}}}),0);assert.equal(await prisma.seller.count({where:{slug:prefix}}),0);assert.equal(await prisma.user.count({where:{firebaseUid:prefix}}),0);pass('All temporary database changes rolled back');
}finally{const results=await Promise.allSettled(uploads.map(item=>storage.remove(item.storageKey)));await prisma.$disconnect();assert.ok(results.every(result=>result.status==='fulfilled'),'Temporary R2 cleanup must succeed');}
console.log(JSON.stringify({checks,rolledBack:true,temporaryImagesRemoved:uploads.length}));
