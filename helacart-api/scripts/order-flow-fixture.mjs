import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {Client} from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../dist/generated/prisma/client.js';

// Real PostgreSQL, isolated from customer tables and catalog visibility.
export async function isolatedOrderDatabase(){
 const schema='helacart_order_audit_'+randomUUID().replaceAll('-','').slice(0,16);
 const connectionString=process.env.DIRECT_URL||process.env.DATABASE_URL;
 const control=new Client({connectionString,connectionTimeoutMillis:15000});await control.connect();let created=false;
 try{
  await control.query('BEGIN');await control.query(`CREATE SCHEMA "${schema}"`);await control.query(`SET LOCAL search_path TO "${schema}"`);
  const migrationRoot=new URL('../prisma/migrations/',import.meta.url);
  const entries=(await readdir(migrationRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
  for(const name of entries){const sql=(await readFile(new URL(name+'/migration.sql',migrationRoot),'utf8')).replace(/CREATE SCHEMA IF NOT EXISTS "public";/g,'');await control.query(sql);}
  await control.query('COMMIT');created=true;
 }catch(error){await control.query('ROLLBACK').catch(()=>{});await control.end();throw error;}
 const prisma=new PrismaClient({adapter:new PrismaPg({connectionString,options:`-c search_path=${schema}`,max:5,connectionTimeoutMillis:15000,statement_timeout:15000},{schema})});
 const close=async()=>{await prisma.$disconnect();if(created&&/^helacart_order_audit_[a-f0-9]{16}$/.test(schema)){await control.query(`DROP SCHEMA "${schema}" CASCADE`);created=false;}await control.end();};
 try{await prisma.$connect();const [scope]=await prisma.$queryRaw`SELECT current_schema() AS schema`;if(scope.schema!==schema)throw new Error('Order audit schema routing could not be verified');return {prisma,schema,close};}catch(error){await close();throw error;}
}

export async function seedOrderFixture(prisma){
 const prefix='order-audit-'+randomUUID();const roles=['buyer','buyerTwo','sellerA','sellerB','admin','other'];
 const identities=Object.fromEntries(roles.map(role=>[role,{uid:prefix+'-'+role,email:prefix+'-'+role+'@example.com',email_verified:true,name:'Audit '+role}]));
 const userIds=Object.fromEntries(roles.map(role=>[role,randomUUID()]));
 const sellers={a:randomUUID(),b:randomUUID()},categoryId=randomUUID(),products=[randomUUID(),randomUUID(),randomUUID()],variants=[randomUUID(),randomUUID(),randomUUID()],addresses={buyer:randomUUID(),buyerTwo:randomUUID()};
 await prisma.$transaction(async tx=>{
  await tx.user.createMany({data:roles.map(role=>({id:userIds[role],firebaseUid:identities[role].uid,email:identities[role].email,emailVerified:true,name:'Audit '+role}))});
  await tx.category.create({data:{id:categoryId,name:'Order audit goods',slug:prefix}});
  await tx.seller.createMany({data:[{id:sellers.a,name:'Audit shop A',slug:prefix+'-a',status:'APPROVED',shippingFeeLkrMinor:35000},{id:sellers.b,name:'Audit shop B',slug:prefix+'-b',status:'APPROVED',shippingFeeLkrMinor:55000}]});
  await tx.sellerMember.createMany({data:[{sellerId:sellers.a,userId:userIds.sellerA,role:'OWNER'},{sellerId:sellers.b,userId:userIds.sellerB,role:'OWNER'}]});
  await tx.product.createMany({data:products.map((id,i)=>({id,sellerId:i<2?sellers.a:sellers.b,categoryId,title:['Audit cotton shirt','Audit cotton bag','Audit ceramic cup'][i],slug:prefix+'-'+i,sku:'AUDIT-'+i,description:'Temporary isolated order audit product',priceLkrMinor:[20000,30000,45000][i],imageUrls:[],status:'APPROVED'}))});
  await tx.productVariant.createMany({data:variants.map((id,i)=>({id,productId:products[i],sellerId:i<2?sellers.a:sellers.b,position:0,sku:'AUDIT-'+i,optionValues:{size:'Standard'},priceLkrMinor:[20000,30000,45000][i],onHand:20,reserved:0}))});
  await tx.buyerAddress.createMany({data:Object.entries(addresses).map(([role,id])=>({id,userId:userIds[role],recipient:'Audit '+role,phone:'0771234567',line1:'12 Audit Road',city:'Kandy',district:'Kandy',postalCode:'20000'}))});
 },{timeout:30000,maxWait:15000});
 return {prefix,identities,userIds,sellers,categoryId,products,variants,addresses};
}
