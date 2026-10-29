"use strict";
const api="/api/member";
const $=id=>document.getElementById(id);
const sections=["login","signup","enroll_mfa","verify_mfa","ready"];
let state={},factor=null;
function message(text){$("message").textContent=text;}
function show(name){for(const s of sections)$(s).hidden=s!==name;$("signup").hidden=!(name==="login"&&state.signupOpen);$("logout").hidden=!(name==="enroll_mfa"||name==="verify_mfa"||name==="ready");}
async function request(action,payload){
  const options={method:payload===undefined?"GET":"POST",credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json","X-HG-Request":"1"}};
  if(payload!==undefined){options.headers["Content-Type"]="application/json";options.body=JSON.stringify(payload);}
  const res=await fetch(api+"?action="+encodeURIComponent(action),options);
  const out=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(out.error||"Request unsuccessful.");
  return out;
}
async function refresh(){
  try{const r=await request("status");state=r;factor=r.factorId||null;
    if(r.state==="signed_out"){show("login");message("Sign in to continue.");}
    else if(r.state==="verify_email"){show(null);$("logout").hidden=false;message("Verify your email before continuing.");}
    else if(r.state==="enroll_mfa"){show("enroll_mfa");message("An authenticator is required.");}
    else if(r.state==="verify_mfa"){show("verify_mfa");message("Enter your authenticator code.");}
    else if(r.state==="ready"){show("ready");$("member-email").textContent=r.user.email||"";message("Secure session verified.");}
    else{show(null);message("Member authentication not available.");}
  }catch(e){show(null);message(e.message);}
}
async function act(fn){message("Processing request…");try{await fn();await refresh();}catch(e){message(e.message);}}
$("login-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);act(async()=>{await request("login",{email:f.get("email"),password:f.get("password")});e.currentTarget.reset();});});
$("signup-form").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);act(async()=>{await request("signup",{email:f.get("email"),password:f.get("password")});e.currentTarget.reset();});});
$("begin-enroll").addEventListener("click",()=>act(async()=>{const r=await request("enroll",{});factor=r.factorId;$("totp-secret").textContent=r.secret||"Secret unavailable";$("enroll-info").hidden=false;}));
async function verify(code){if(!factor)throw Error("Missing authenticator; reload and try again.");const c=await request("challenge",{factorId:factor});await request("verify",{factorId:factor,challengeId:c.challengeId,code});$("totp-secret").textContent="";$("enroll-info").hidden=true;}
for(const form of ["verify-code","enroll-code"])$(form).addEventListener("submit",e=>{e.preventDefault();const code=new FormData(e.currentTarget).get("code");act(async()=>{await verify(code);e.currentTarget.reset();});});
$("logout").addEventListener("click",()=>act(async()=>{await request("logout",{});$("totp-secret").textContent="";$("enroll-info").hidden=true;}));
$("load-profile").addEventListener("click",()=>act(async()=>{const r=await request("profile");$("profile-result").textContent=r.profile?"Display name: "+(r.profile.display_name||"(not set)"):"No member profile created yet."; }));
refresh();
