const Joi = require('joi');
const getResponse = require('../helper/index');
const User = require('../mongoModels/UserModel');
const bcrypt = require('bcryptjs');

exports.UpdateUser = async (req, res, next) => {
    try {
        const schema = Joi.object({
            email: Joi.string().email().required(),
            phone: Joi.string().min(6).optional(),
            name: Joi.string().min(2).optional(),
            password: Joi.string().min(5).required()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        const user = await User.findById(req.user.id);

        let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
        if (!user || !passwordIsValid) return res.status(409).send({ auth: false, accessToken: null, msg: 'Wrong Password!' });

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong!'));
    }
};

exports.ForgotPassword = async (req, res, next) => {
    try {
        const schema = Joi.object({
            email: Joi.string().email().required()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        const user = await User.findOne({ email: req.body.email });

        if (!user) return res.status(403).send(getResponse(0, 'User with given email not found.'));

        req.user = user;
        
        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong.'))
    }
}

exports.ConfirmForgotPassword = async (req, res, next) => {
    try {
        const schema = Joi.object({
            password: Joi.string().min(5).required(),
            key: Joi.string().min(5).required()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong.'))
    }
}

exports.SignUp = async (req, res, next) => {
    console.log(req.body);
    console.log(req.headers);
    try {
        const schema = Joi.object({
            type: Joi.string().min(2).required(),
            username: Joi.string().min(4).required(),
            email: Joi.string().email().optional(),
            password: Joi.string().min(5).required(),
            name: Joi.string().min(2).required(),
            company: Joi.string().optional(),
            Phone: Joi.string().min(5).optional(),
            businessType: Joi.string().optional(),
            usDotNumber: Joi.optional(),
            mcNumber: Joi.string().optional()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.send(getResponse(0, result.error.message));

        // check username is already in use
        let username = await User.findOne({ username: req.body.username });
        if (username) return res.send(getResponse(0, "Fail -> Username is already taken!"));

        // check email is already in use
        userEmail = await User.findOne({ email: req.body.email });
        if (userEmail) return res.send(getResponse(0, "Fail -> Email is already in use!"));

        return next();
    } catch (error) {
        return res.send(getResponse(0, 'Something went wrong.'))
    }
}

exports.SignIn = async (req, res, next) => {
    try {
        const schema = Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
            deviceInfo: Joi.object().optional(),
            deviceType: Joi.string().optional()
        });
        const result = schema.validate(req.body);
        if (result.error) return res.status(401).send({ auth: false, msg: result.error.message, status: 0 });

        const user = await User.findOne({ $or: [{ "username": req.body.username }, { "email": req.body.username }] });

        if (!user) {
            return res.status(404).send({ auth: false, msg: 'User Not Found.', status: 0 });
        }

        let passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
        if (!passwordIsValid) {
            return res.status(401).send({ auth: false, msg: 'Invalid Username or Password!', status: 0 });
        }

        if (user.isActive == 0) {
            return res.status(401).send({ auth: false, msg: 'You need an activation!', status: 0 });
        }
        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).send(getResponse(0, 'Something went wrong.'))
    }
}