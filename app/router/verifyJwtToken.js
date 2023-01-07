const jwt = require('jsonwebtoken');
const config = require('../config/config.js');
const db = require('../config/db.config.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const moment = require('moment');
// const User = db.user;

const ApiKey = require('../mongoModels/ApiKeyModel');
const Helper = require('../classes/helpers');
const ErrorMessages = require('../constants');
const User = require('../mongoModels/UserModel');
const sha256 = require('sha256');

const verifyToken = async (req, res, next) => {
	let token = req.headers['x-access-token'];
	// console.log(' --- verifyToken - action ')
	// return next();
	if (!token){
		// check auth key
		try{
			let apiKey = req.headers['api_key'];
			let apiTime = req.headers['api_time'];
			
			if(!apiKey){
				apiKey = req.query['api_key'];
			}
			if(!apiTime){
				apiTime = req.query['api_time'];
			}

			if(apiKey && apiTime){
				if(new Date() - new Date(apiTime) > 120000){ // 2 min
					return res.status(500).send({ 
						auth: false, 
						message: 'Timeout'
					});
				}

				const user = await User.findOne({ where: { apiKey: apiKey } });
				
				if(!user){
					return res.status(500).send({ 
						auth: false, 
						message: ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication
					});
				}
				
				const sha256 = require('sha256');
				const apiHash = req.query['api_hash'];
				if(apiHash){
					const hash = sha256(apiKey + apiTime + user.apiSecret);
					if(hash != apiHash){
						return res.status(500).send({ 
							auth: false, 
							message: ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication
						});
					}
				}else{
					const hash = sha256(apiKey + apiTime);
					if(hash != user.apiHash){
						return res.status(500).send({ 
							auth: false, 
							message: ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication
						});
					}
				}
				
				// ok
				req.user = user;
				return next();
			}
		}catch(ex){
			return res.status(403).send({ 
				auth: false, message: ErrorMessages.AutenticationVerifyErrorMessages.noApiProvided 
			});
		}

		//
		console.log("Rejected  token", req.headers['x-access-token']);
		console.table([{ "Host": req.headers.host , "Time" : moment().format(), "url": req.url, "method": req.method }]);
		return res.status(403).send({ 
			auth: false, message: ErrorMessages.AutenticationVerifyErrorMessages.noTokenProvided 
			
		});
	}

	try{
		var jwtUUID = '1234567890';
		const path = 'jwt.uuid';
		if (fs.existsSync(path)){
			jwtUUID = fs.readFileSync(path, 'utf8').toString();
		}

		let ValidToken = false;
		await jwt.verify(token, config.secret, async (err, decoded) => {
			let user;
			if (decoded) {
				user = await User.findOne({
					where: {
						id: decoded.user.id
					}
				});	

				// check is active
				if(user.isActive == 0){
					return res.status(500).send({ 
						auth: false, 
						message: ErrorMessages.AutenticationVerifyErrorMessages.inActiveUser
					});	
				}
			}
			if (err || new Date(user.changePasswordAt).getTime() > decoded.iat * 1000 || new Date(user.logoutAt).getTime() > decoded.iat * 1000 || decoded.jwtUUID != jwtUUID){
				console.log("Rejected  token", req.headers['x-access-token']);
				console.table([{ "Host": req.headers.host , "Time" : moment().format(), "url": req.url, "method": req.method }]);
				return res.status(500).send({ 
					auth: false, 
					message: `${ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication} Error ->  ${err}` 
				});
			}
			else{
				ValidToken = true;
			}
			req.user = decoded.user;
		});

		if(!ValidToken){
			return res.status(401).send({ status: 0, auth: false, accessToken: null, msg: ErrorMessages.AutenticationVerifyErrorMessages.invalidToken });
		}

		if (ValidToken && req.url == '/api/auth/changepassword' && req.method == 'POST') {
			console.log("Rejected token:", req.headers['x-access-token']);
			console.table([{ "Host": req.headers.host , "Time" : moment().format(), "url": req.url, "method": req.method }]);
			const user = await User.findOne({
				where: {
					id: req.user.id
				}
			});
			const passwordIsValid = bcrypt.compareSync(req.body.passwordOld, user.password);
			if (!passwordIsValid) {
				return res.status(401).send({ status: 0, auth: false, accessToken: null, msg: ErrorMessages.AutenticationVerifyErrorMessages.invalidPassword });
			}
			const updatePass = await User.update({
				password: bcrypt.hashSync(req.body.passwordNew, 8),
				changePasswordAt: Date.now()
			}, {
				where: {
					id: req.user.id
				}
			});
			if (updatePass[0]) {
				return res.status(401).send({ status: 0, auth: false, accessToken: null, msg: 'Password changed' });
			}
		} else if(ValidToken && req.url != '/api/auth/changepassword') {
			next();
		}
	}catch(ex){
		return res.status(500).send({ status: 0, auth: false, msg: ex.message });
	}
};

const verifyKey = async (req, res, next) => {
	//return next();
	try {
		// let { apiKey } = req.query;
		let apiKey = req.headers['x-api-key'];
		let info = await Helper.getRemoteInfoForKey(req);
		let key;
		
		if (apiKey) {
			key = await ApiKey.findOne({
				Key: apiKey,
				host: info.host
			});
			let expire = key ? key.Expire : 0;
			let now = new Date();
			if (key && expire.getTime() > now.getTime()) {
				next();
			} else {
				return res.status(409).json({
					status: 0,
					msg: ErrorMessages.AutenticationVerifyErrorMessages.expiredKey
				});
			}
		} else {
			return res.status(409).json({
				status: 0,
				msg: ErrorMessages.AutenticationVerifyErrorMessages.requiredApiKey
			});
		}

	} catch (error) {
		res.status(409).json({
			status: 0,
			msg: error.message
		});
	}
};

const isAdmin = (req, res, next) => {	
	User.findById(req.userId)
		.then(user => {
			user.getRoles().then(roles => {
				for(let i=0; i<roles.length; i++){
					console.log(roles[i].name);
					if(roles[i].name.toUpperCase() === "ADMIN"){
						next();
						return;
					}
				}
			
				res.status(403).send("Require Admin Role!");
				return;
			});
		});
};

const isPmOrAdmin = (req, res, next) => {
	User.findOne({
		where: { id: req.userId }
	})
	//findById(req.userId)
		.then(user => {
			user.getRoles().then(roles => {
				for(let i=0; i<roles.length; i++){					
					if(roles[i].name.toUpperCase() === "PM"){
						next();
						return;
					}
					
					if(roles[i].name.toUpperCase() === "ADMIN"){
						next();
						return;
					}
				}
				
				res.status(403).send("Require PM or Admin Roles!");
			});
		}).catch(err => {
			res.status(500).send({
				'description': 'Can not access Admin Board',
				'error': err
			});
		});
};

const isDriver = (req, res, next) => {

};





const verifyRequest = async (req, res, next) => {
	// check key
	const apiKey = req.headers['api_key'] || req.query['api_key'];
	const apiTime = req.headers['api_time'] || req.query['api_time'];
	const apiHash = req.headers['api_hash'] || req.query['api_hash'];

	if(apiKey && apiTime && apiHash){
		// verify by key
		const apiUser = await verifyAPIKey_Mongo(apiKey, apiTime, apiHash)
		if(apiUser === ErrorMessages.AutenticationVerifyErrorMessages.inActiveUser || ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication ){
			return res.status(401).send({ 
				auth: false, 
				message: apiUser
			});
		}
		req.user = tokenUser
		return next()
	}

	// check token
	let token = req.headers['x-access-token'];
	// if(!token){
	// 	return res.status(403).send({ 
	// 		auth: false,
	// 		message: 'No token provided.' 
	// 	});
	// }

	// verify token
	const tokenUser = await verifyToken_Mongo(token)
	if(typeof tokenUser == 'string'){
		return res.status(401).send({ status: 0, auth: false, accessToken: null, msg: 'Invalid Password!' });
		// return res.status(500).send({
		// 	status: 0, 
		// 	auth: false, 
		// 	accessToken: null, 
		// 	msg: tokenUser
		// 	// auth: false, 
		// 	// message: tokenUser
		// });
	}
	req.user = tokenUser
	return next()
};

// verify token
async function verifyToken_Mongo(token){
	try{
		const decoded = await jwt.verify(token, config.secret)

		const user = await User.findById(decoded.user.id);	

		// check is active
		if(user.isActive == 0){
			return ErrorMessages.AutenticationVerifyErrorMessages.inActiveUser;
		}
	
		if (new Date(user.changePasswordAt).getTime() > decoded.iat * 1000 
			|| new Date(user.logoutAt).getTime() > decoded.iat * 1000 
			|| decoded.jwtUUID != config.jwtUUID){
			return ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication;
		}

		return user;

		// // if (req.url == '/api/auth/changepassword'){ // && req.method == 'POST') {
		// // 	const passwordIsValid = bcrypt.compareSync(req.body.passwordOld, user.password);
		// // 	if (!passwordIsValid) {
		// // 		return 'Invalid Password!';
		// // 	}

		// // 	const updatePass = await User.updateOne({ _id: user._id },{
		// // 		password: bcrypt.hashSync(req.body.passwordNew, 8),
		// // 		changePasswordAt: Date.now()
		// // 	})
		// // 	if(updatePass.matchedCount != 1){
		// // 		return 'Password changed';
		// // 	}
		// // }
		// 	// if (updatePass[0]) {
		// 	// 	return res.status(401).send({ status: 0, auth: false, accessToken: null, msg: 'Password changed' });
		// 	// }
		// // } else if(req.url != '/api/auth/changepassword') {
		// // 	next();
		// // }
		// return true
		// // next();
	}catch(err){
		return err.message
	}
};

// verify api key 
async function verifyAPIKey_Mongo(apiKey, apiTime, apiHash){
	try{
		if(new Date() - new Date(apiTime) > 120000){ // 2 min
			return 'Timeout';
		}

		const user = await User.findOne({ apiKey: apiKey });
		
		if(!user){
			return ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication;
		}

		const hash = sha256(apiKey + apiTime + user.apiSecret);
		if(hash != apiHash){
			return ErrorMessages.AutenticationVerifyErrorMessages.failToAutentication;
		}

		// ok
		return user
	}catch(ex){
		return ErrorMessages.AutenticationVerifyErrorMessages.noApiProvided;
	}
};

const authJwt = {};
authJwt.verifyToken = verifyRequest; // verifyToken_Mongo; // verifyToken;
authJwt.verifyKey = verifyKey;
authJwt.isAdmin = isAdmin;
authJwt.isPmOrAdmin = isPmOrAdmin;

module.exports = authJwt;