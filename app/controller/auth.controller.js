const db = require('../config/db.config.js');
const config = require('../config/config.js');
const Clients = require('../mongoControllers/ClientsController');
const Errors = require('../errors/authErrors');
const fs = require('fs');
const User = db.user;
const Role = db.role;
const UserRole = db.user_role;
const UserTypes = db.user_types;
// const Driver = db.driver;
const Op = db.Sequelize.Op;
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
const tokenList = {};

exports.signUp = async (req, res) => {
	// let roles;
	// roles = await Role.findOne({
	// 	where: {
	// 		name: req.body.roles
	// 	}
	// });

	// console.log(' --', roles)
	// // Save User to Database
	// if (roles) {
	let client, user;
	client = await Clients.create(req.body);
	if (client.status) {
		user = await User.create({
			name: req.body.name,
			username: req.body.username,
			email: req.body.email,
			mcNumber: req.body.mcNumber || null,
			usDotNumber: req.body.usDotNumber || null,
			password: bcrypt.hashSync(req.body.password, 8),
			isActive: 0
		});
		if (user) {
			// const role = roles.dataValues;
			const userData = user.dataValues;
			const type = await UserTypes.create({
				userId: userData.id,
				types: req.body.type
			});
			// const userRole = await UserRole.create({
			// 	roleId: role.id,
			// 	userId: userData.id
			// });
			let updClient = await Clients.edit({
				id: client.data._id,
				obj: {
					ID: user.id
				}
			});

			console.log(updClient);

			res.json({
				msg: 'ok',
				// userRole,
				type,
				user
			});
		} else {
			// res.status(409).send({ msg: "Error" });
			res.status(500).send({ msg: "User create error" });
		}
	} else {
		// res.status(409).send({ msg: "Error" });
		res.status(500).send({ msg: "Client create error" });
	}

	// } else {
	// 	res.status(500).json({
	// 		msg: 'such role doesn\'t exist'
	// 	});
	// }

};

exports.signIn = (req, res) => {
	User.findOne({
		where: {
			[Op.or]: [{ username: req.body.username }, { email: req.body.username }]
		}
	}).then(async user => {
		if (!user) {
			return res.status(404).send({ auth: false, msg: 'User Not Found.', status: 0 });
		}
		let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
		if (!passwordIsValid) {
			return res.status(401).send({ auth: false, msg: 'Invalid Password!', status: 0 });
		}

		// in active user
		if (user.isActive == 0) {
			return res.status(401).send({ auth: false, msg: 'You need an activation!', status: 0 });
		}

		let authorities = [];
		// const roles = await user.getRoles();
		// for (let i = 0; i < roles.length; i++) {
		// 	authorities.push('ROLE_' + roles[i].name.toUpperCase());
		// }
		const types = await UserTypes.findOne({
			where: {
				userId: user.id
			}
		});
		// let driver;
		// driver = await Driver.findOne({
		// 	where: {
		// 		email: user.email
		// 	}
		// });
		// const Error = await Errors.authError({
		// 	body: req.body,
		// 	user,
		// 	driver,
		// 	types,
		// 	authorities
		// });
		// if (Error.error) {
		// 	res.status(401).send({
		// 		status: 0,
		// 		msg: Error.msg,
		// 		auth: false
		// 	});
		// } else {
		var jwtUUID = '1234567890';
		const path = 'jwt.uuid';
		if (fs.existsSync(path)) {
			jwtUUID = fs.readFileSync(path, 'utf8').toString();
		}
		let expire = '31d';
		user.dataValues.type = types ? types.types : '';
		delete user.dataValues.password;
		const token = jwt.sign({ user: user, jwtUUID }, config.secret, {
			expiresIn: expire // expires in 31 day
		});
		const response = {
			auth: true,
			status: 1,
			accessToken: token,
			username: user.username,
			userId: user.id,
			// driverId: driver ? driver.id : '',
			userType: user.dataValues.type,
			ttt: user.type,
			authorities: authorities
		};
		tokenList[token] = response;
		res.status(200).send(response);
		// }

	}).catch(err => {
		res.status(500).send({
			msg: err.message,
			auth: false,
			status: 0
		});
	});
};

exports.changePassword = async (req, res) => {
	const postData = req.body;
	console.log(req.headers['x-access-token']);
	const user = await User.findOne({
		where: {
			[Op.or]: {
				username: req.body.username,
				email: req.body.username
			}
		}
	});

	if (!user) return res.status(401).send({ reason: 'User Not Found.' });

	let passwordIsValid = bcrypt.compareSync(req.body.passwordOld, user.password);
	if (!passwordIsValid) return res.status(409).send({ auth: false, accessToken: null, reason: 'Invalid Password!' });

	await User.update({
		password: bcrypt.hashSync(req.body.passwordNew, 8),
		changePasswordAt: Date.now()
	},
		{
			where: { id: user.id }
		});

	if ((postData.token) && (postData.token in tokenList)) res.status(200).send({
		username: user.username,
		msg: 'Password was changed successfully'
	});
	else {
		res.status(409).json({
			status: 0,
			msg: "invalid Token"
		});
	}
};

exports.userContent = (req, res) => {
	User.findOne({
		where: { id: req.userId },
		attributes: ['name', 'username', 'email'],
		include: [{
			model: Role,
			attributes: ['id', 'name'],
			through: {
				attributes: ['userId', 'roleId'],
			}
		}]
	}).then(user => {
		res.status(200).send({
			'description': '>>> User Contents!',
			'user': user
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access User Page',
			'error': err
		});
	});
};

exports.adminBoard = (req, res) => {
	User.findOne({
		where: { id: req.userId },
		attributes: ['name', 'username', 'email'],
		include: [{
			model: Role,
			attributes: ['id', 'name'],
			through: {
				attributes: ['userId', 'roleId'],
			}
		}]
	}).then(user => {
		res.status(200).send({
			'description': '>>> Admin Contents',
			'user': user
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access Admin Board',
			'error': err
		});
	});
};

exports.managementBoard = (req, res) => {
	User.findOne({
		where: { id: req.userId },
		attributes: ['name', 'username', 'email'],
		include: [{
			model: Role,
			attributes: ['id', 'name'],
			through: {
				attributes: ['userId', 'roleId'],
			}
		}]
	}).then(user => {
		res.status(200).send({
			'description': '>>> Project Management Board',
			'user': user
		});
	}).catch(err => {
		res.status(500).send({
			'description': 'Can not access Management Board',
			'error': err
		});
	});
};

exports.signOut = async (req, res) => {
	try {
		const userId = req.user.id;
		const user = await User.update({
			logoutAt: Date.now()
		}, {
			where: {
				id: userId
			}
		});
		if (user[0]) {
			res.json({
				status: 1,
				msg: "SignOut"
			});
		}
	} catch (error) {
		res.status(500).send({
			msg: error.message,
			status: 0
		});
	}
};

exports.logOutScript = async (req, res) => {
	try {
		const users = await User.update({
			logoutAt: Date.now()
		}, {
			where: {}
		});
		console.log(users);
		const allUsers = await User.findAll();
		res.send({
			allUsers
		});

	} catch (error) {
		res.status(500).send({
			error
		});
	}
};

