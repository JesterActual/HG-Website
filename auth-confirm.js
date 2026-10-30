"use strict";
const status=document.getElementById("status"),button=document.getElementById("confirm");
const q=new URLSearchParams(location.search), tokenHash=q.get("token_hash"), type=q.get("type");
const valid=/^[0-9a-f]{64}$/i.test(tokenHash||"") && (type==="email"||type==="recovery");
// Remove one-time tokens from visible URL without sending them over the network.
// No scripts, remote assets or third-party analytics are loaded on this page.
history.replaceState(null,"","/auth/confirm.html");
if(valid){button.hidden=false;status.textContent=type==="email"?"Confirm your email address to continue.":"Confirm your password recovery request. Your authenticator will still be required.";}
else status.textContent="This confirmation link is incomplete or invalid. Please request a new email.";
button.addEventListener("click",async()=>{
  button.disabled=true;status.textContent="Verifying your link…";
  try{
    const r=await fetch("/api/member?action=confirm",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json","X-HG-Request":"1"},body:JSON.stringify({tokenHash,type})});
    const b=await r.json();
    if(!r.ok)throw Error(b.error||"Confirmation failed.");
    status.textContent=type==="recovery"?"Link verified. Sign in and complete authenticator verification to change your password.":"Email verified. Return to the Member Portal to sign in and complete your authenticator setup.";
    button.hidden=true;
  }catch(e){status.textContent=e.message;button.disabled=false;}
});
