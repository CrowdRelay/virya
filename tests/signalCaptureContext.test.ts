import {test} from "node:test"
import assert from "node:assert/strict"
import {captureContextFromSearch,captureContextForPage,captureReturnPath,validatedCaptureContext} from "../src/lib/signalCaptureContext.ts"
test("promise and local resource survive confirmation on another device",()=>{
 const c=captureContextFromSearch("?utm_source=telegram&offer=shows&event=real-show")
 assert.deepEqual(c,{offer:"shows",event_slug:"real-show"})
 assert.equal(captureReturnPath(c,"pl"),"/pl/live/real-show/")
 assert.equal(captureReturnPath({offer:"releases",video_id:"AbCdEfGhI12"},"en"),"/watch/AbCdEfGhI12/")
})
test("unknown promises and redirect injection cannot produce copy or navigation",()=>{
 for(const slug of ["//evil.test","../admin","x?token=y","x#y","UPPER",""]) assert.equal(validatedCaptureContext({event_slug:slug}),undefined)
 assert.equal(captureReturnPath({return_url:"https://evil.test",offer:"prize"},"pl"),"/pl/my-signal/")
 assert.deepEqual(validatedCaptureContext({offer:"shows",event_slug:"real-show",video_id:"AbCdEfGhI12"}),{offer:"shows"})
})
test("a resource form preserves its actual resource instead of injected query context",()=>{
 assert.deepEqual(captureContextForPage("/pl/live/real-show/","?offer=releases&event=other"),{offer:"shows",event_slug:"real-show"})
 assert.deepEqual(captureContextForPage("/watch/AbCdEfGhI12/","?event=other"),{offer:"releases",video_id:"AbCdEfGhI12"})
})
