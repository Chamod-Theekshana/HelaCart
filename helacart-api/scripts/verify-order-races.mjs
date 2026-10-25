import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {isolatedOrderDatabase,seedOrderFixture} from './order-flow-fixture.mjs';
import {AuthService} from '../dist/auth/auth.service.js';
import {CatalogService} from '../dist/catalog/catalog.service.js';
import {CommerceService} from '../dist/commerce/commerce.service.js';
import {NotificationsService} from '../dist/notifications/notifications.service.js';
const db=await isolatedOrderDatabase();let checks=0;
if(process.argv.includes('--inspect')){
 try{await db.prisma.$queryRawUnsafe("DO $$BEGIN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Isolated audit serialization error'; END$$;");}
 catch(error){console.log(JSON.stringify({code:error.code,meta:error.meta,name:error.name}));}
 finally{await db.close();}
 process.exit(0);
}
try{
 const p=db.prisma,f=await seedOrderFixture(p),auth=new AuthService(p),commerce=new CommerceService(p,auth,new CatalogService(p,auth),new NotificationsService(p,auth));
 await p.productVariant.update({where:{id:f.variants[0]},data:{onHand:1}});
 await commerce.setCartItem(f.identities.buyer,f.variants[0],1);await commerce.setCartItem(f.identities.buyerTwo,f.variants[0],1);
 const c1=await commerce.cart(f.identities.buyer),c2=await commerce.cart(f.identities.buyerTwo);
 const results=await Promise.allSettled([commerce.checkout(f.identities.buyer,{addressId:f.addresses.buyer,checkoutKey:randomUUID(),quote:c1.checkoutQuote}),commerce.checkout(f.identities.buyerTwo,{addressId:f.addresses.buyerTwo,checkoutKey:randomUUID(),quote:c2.checkoutQuote})]);
 console.log(JSON.stringify(results.map(r=>r.status==='fulfilled'?{status:r.status}:{status:r.status,httpStatus:r.reason.status,code:r.reason.code,meta:r.reason.meta,message:r.reason.message?.slice(-600)})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);checks++;console.log('PASS Last-item checkout is atomic and the loser receives a retryable conflict');
 const winner=results.find(r=>r.status==='fulfilled').value,identity=winner.buyerId===f.userIds.buyer?f.identities.buyer:f.identities.buyerTwo;
 const cancel=await Promise.allSettled([commerce.buyerCancel(identity,winner.id,winner.sellerOrders[0].id),commerce.buyerCancel(identity,winner.id,winner.sellerOrders[0].id)]);assert.equal(cancel.filter(r=>r.status==='fulfilled').length,1);assert.equal((await p.productVariant.findUniqueOrThrow({where:{id:f.variants[0]}})).onHand,1);checks++;console.log('PASS Simultaneous cancellation restores stock once');
 await p.cartItem.deleteMany();await p.productVariant.update({where:{id:f.variants[0]},data:{onHand:2}});await commerce.setCartItem(f.identities.buyer,f.variants[0],1);const cart=await commerce.cart(f.identities.buyer),dto={addressId:f.addresses.buyer,checkoutKey:randomUUID(),quote:cart.checkoutQuote};
 const duplicate=await Promise.all([commerce.checkout(f.identities.buyer,dto),commerce.checkout(f.identities.buyer,dto)]);assert.equal(duplicate[0].id,duplicate[1].id);assert.equal((await p.productVariant.findUniqueOrThrow({where:{id:f.variants[0]}})).onHand,1);checks++;console.log('PASS Identical concurrent checkout retries commit one order');
}finally{await db.close();}
console.log(JSON.stringify({checks,isolatedSchemaRemoved:true}));
