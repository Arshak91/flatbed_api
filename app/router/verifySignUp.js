const db = require('../config/db.config.js');
const config = require('../config/config.js');
const ROLEs = config.ROLEs;
const User = db.user;
const Op = db.Sequelize.Op;

const checkDuplicateUserNameOrEmail = (req, res, next) => {
	// -> Check Username is already in use
	User.findOne({
		where: {
			username: req.body.username
		}
	}).then(user => {
		if (user) {
			res.status(400).send({ status: 0, msg: "Fail -> Username is already taken!" });
			return;
		}

		// -> Check Email is already in use
		User.findOne({
			where: {
				email: req.body.email
			}
		}).then(user => {
			if (user) {
				res.status(400).send({ status: 0, msg: "Fail -> Email is already in use!" });
				return;
			}

			next();
		});
	});
};

const checkRolesExisted = (req, res, next) => {
	for (let i = 0; i < req.body.roles.length; i++) {
		if (!ROLEs.includes(req.body.roles[i].toUpperCase())) {
			res.status(400).send({ status: 0, msg: "Fail -> Does NOT exist Role = " + req.body.roles[i] });
			return;
		}
	}
	next();
};

const signUpVerify = {};
signUpVerify.checkDuplicateUserNameOrEmail = checkDuplicateUserNameOrEmail;
signUpVerify.checkRolesExisted = checkRolesExisted;

module.exports = signUpVerify;