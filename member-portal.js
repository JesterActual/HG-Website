"use strict";
const api="/api/member";
const $=id=>document.getElementById(id);
const sections=["login","signup","enroll_mfa","verify_mfa","ready"];
let state={},factor=null, enrollment=null;
function message(text){$("message").textContent=text;}
function show(name){for(const s of sections)$(s).hidden=s!==name;$("signup").hidden=!(name==="login"&&state.signupOpen);$("recovery").hidden=!(name==="login"&&state.recoveryOpen);$("logout").hidden=!(name==="enroll_mfa"||name==="verify_mfa"||name==="ready");}
async function request(action,payload){
  const options={method:payload===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json","X-HG-Request":"1"}};
  if(payload!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(payload);}
  const res=await fetch(api+"?action="+encodeURIComponent(action),options);
  const out=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(out.error||"Request unsuccessful.");
  return out;
}
async function refresh(){
  try{const r=await request("status");state=r;factor=enrollment?.factorId||r.factorId||null;
    if(r.state==="signed_out"){show("login");message("Sign in to continue.");}
    else if(r.state==="verify_email"){show(null);$("logout").hidden=false;message("Verify your email before continuing.");}
    else if(r.state==="enroll_mfa"){show("enroll_mfa");message("An authenticator is required.");}
    else if(r.state==="verify_mfa"){show("verify_mfa");message("Enter your authenticator code.");}
    else if(r.state==="ready"){show("ready");$("member-email").textContent=r.user.email||"";message("Secure session verified.");}
    else{show(null);message("Member authentication not available.");}
  }catch(e){show(null);message(e.message);}
}
async function act(fn){message("Processing request…");try{const note=await fn();await refresh();if(note)message(note);}catch(e){message(e.message);}}
$("login-form").addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);act(async()=>{await request("login",{email:f.get("email"),password:f.get("password")});form.reset();});});
$("signup-form").addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form);act(async()=>{await request("signup",{email:f.get("email"),password:f.get("password")});form.reset();return "If this address is eligible, check your email for confirmation.";});});
function clearEnrollmentDisplay(){
  const img=$("totp-qr");img.hidden=true;img.removeAttribute("src");
  $("qr-unavailable").hidden=true;
  $("totp-secret").textContent="";
  $("enroll-info").hidden=true;
  const details=$("totp-secret").closest("details");if(details)details.open=false;
}
function displayQr(qr){
  const img=$("totp-qr");
  if(typeof qr!=="string")return false;
  const value=qr.trim();
  // Supabase may return raw SVG or an SVG data URI (including ;utf-8).
  // Never send the enrollment secret to a third-party QR service.
  let src="";
  if(/^data:image\/svg\+xml(?:;(?:charset=)?utf-?8)?(?:;base64)?,/i.test(value))src=value;
  else if(/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(value))src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(value);
  if(!src)return false;
  img.src=src;img.hidden=false;return true;
}
$("begin-enroll").addEventListener("click",()=>act(async()=>{
  const r=await request("enroll",{});
  clearEnrollmentDisplay();
  factor=r.factorId;enrollment={factorId:r.factorId};
  $("totp-secret").textContent=r.secret||"Manual key unavailable.";
  $("qr-unavailable").hidden=displayQr(r.qrCode);
  $("enroll-info").hidden=false;
}));
async function verify(code){if(!factor)throw Error("Missing authenticator; reload and try again.");const c=await request("challenge",{factorId:factor});await request("verify",{factorId:factor,challengeId:c.challengeId,code});clearEnrollmentDisplay();enrollment=null;}
for(const id of ["verify-code","enroll-code"])$(id).addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget,code=new FormData(form).get("code");act(async()=>{await verify(code);form.reset();});});
$("logout").addEventListener("click",()=>act(async()=>{await request("logout",{});clearEnrollmentDisplay();enrollment=null;}));
$("load-profile").addEventListener("click",()=>act(async()=>{const r=await request("profile");$("profile-result").textContent=r.profile?"Display name: "+(r.profile.display_name||"(not set)"):"No member profile created yet."; }));
refresh();

$("request-recovery").addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget,email=new FormData(form).get("email");act(async()=>{const r=await request("request_recovery",{email});form.reset();return r.message;});});
$("change-password").addEventListener("submit",e=>{e.preventDefault();const form=e.currentTarget,password=new FormData(form).get("password");act(async()=>{const r=await request("change_password",{password});form.reset();return r.message;});});
