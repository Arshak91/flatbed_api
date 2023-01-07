module.exports = (sequelize, Sequelize) => {
	const User = sequelize.define('users', {
		name: {
			type: Sequelize.STRING
		},
		username: {
			type: Sequelize.STRING
		},
		email: {
			type: Sequelize.STRING
		},
		password: {
			type: Sequelize.STRING
		},
		changePasswordAt: { type: Sequelize.DATE },
		logoutAt: { type: Sequelize.DATE },

		isActive: { type: Sequelize.INTEGER },
		// apiKey: { type: Sequelize.STRING },
		// apiSecret: { type: Sequelize.STRING },
		// apiHash: { type: Sequelize.STRING },

		createdAt: { type: Sequelize.DATE },
        updatedAt: { type: Sequelize.DATE }
	});
	
	return User;
};
