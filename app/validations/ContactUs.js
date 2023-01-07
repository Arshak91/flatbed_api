const Joi = require('joi');
const getResponse = require('../helper/index');

exports.CreateContacUsMessageValidations = async (req, res, next) => {
    try {
        const schema = Joi.object({
            message: Joi.string().min(10).required(),
            type: Joi.number().min(1).max(4).required()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        if (!req.user || !req.user.email) return res.send(getResponse(0, 'User not have an email'));

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong!')); 
    }
};
