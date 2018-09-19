//very simple stitch custom login example

const client = stitch.Stitch.initializeDefaultAppClient("client-appid");

const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const stitchLoginAdapterURL = "http://url.for.login.adapter.server.com";
const lcsLogin = (email, password) => {
    const body=JSON.stringify({email, password})
    return fetch(stitchLoginAdaptorURL, {
	method: "POST",
	headers: {
	    "Content-Type": "application/json"
	},
	body
    }).then(r=>r.json())
}

document.getElementById("loginButton").onclick= e => {
    const email = emailInput.value;
    const password = passwordInput.value;
    lcsLogin(email, password).then(({validLogin, token, err}) => {
	console.log(validLogin, token, err)
	if(validLogin){
	    const credential = new stitch.CustomCredential(token);
	    return client.auth.loginWithCredential(credential);
	}else{
	    console.log(err);
	    throw new Error(err.toString());
	}
    }).then(authedUser => {
	console.log("authed with id", authedUser.id);
	console.log(authedUser.data); //:C
    }).catch(err => {
	console.error(err)
	alert("login failed: "+err.message)
    });    
}
