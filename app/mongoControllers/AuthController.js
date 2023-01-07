const config = require('../config/config.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongo = require('mongodb');
const User = require('../mongoModels/UserModel');
const tokenList = {};
const Mailer = require('../classes/mailer');
const SettingsModel = require('../mongoModels/SettingsModel.js');
const getResponse = require('../helper');
const env = process.env.SERVER == 'local' ? require('../config/env.local.js') : require('../config/env.js');

exports.activateUser = async (req, res) => {
    const user = await User.findOne({ username: req.query.userName });
    if (user.isActive === 0) {
        if (!!req.query.sendEmail) {
            await sendActivationEmailToUser(user, req.query.text || null),
            await sendActivationEmailToUser({ email: 'aram@bib.am', username: user.username }, req.query.text || null)
            user.isActive = 1;
        }
    } else user.isActive = 0;
7
    await user.save();
    return res.send(getResponse(1, `${user.isActive === 0 ? 'User blocked' : 'User activated'}`));
}
// edit user detail
exports.changeUserDetail = async (req, res) => {
    const user = await User.findById(req.user.id);

    user.email = req.body.email;
    user.Phone = req.body.phone;
    user.name = req.body.name;

    await user.save();
    return res.status(200).send({ msg: 'User information successfully updated.' });
}
// get user detail
exports.detail = async (req, res) => {
    const user = await User.findById(req.user.id);
    const detail = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        type: user.type || '',
        Phone: user.Phone
    };
    return res.status(200).send({ status: 1, detail, msg: 'User detail successfully getted.' });
};
// forgot send email
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 1); // expires in 1 day

    const secretKey = jwt.sign({ user: req.user.id, jwtUUID: config.jwtUUID }, config.secret, {
        expiresIn: expireDate.getMilliseconds()
    });

    const link = `https://testapp.getflatbeds.com/auth/reset?key=${secretKey}`;

    await Mailer.sendMail(email, 'Restore password link.', `click hear to restore your password ${link}`);
    return res.status(200).send({ status: 1, msg: 'Check your email to restore your password' });
};
// confirm forgot password
exports.confirmForgotPassword = async (req, res) => {
    const { password, key } = req.body;
    const decodedToken = jwt.verify(key, config.secret);
    const user = await User.findById(decodedToken.user);
    const date = new Date();
    if (!user || decodedToken.expiresIn < date.getMilliseconds()) return res.status(403).send({ status: 0, msg: 'This link was expired' });
    user.password = bcrypt.hashSync(password, 8);
    await user.save();

    return res.status(200).send({ status: 1, msg: 'Password successfully changed' });
}
// sign up
exports.signUp = async (req, res) => {
    try {
        const user = await User.create({
            type: req.body.type,
            username: req.body.username,
            email: req.body.email,
            password: bcrypt.hashSync(req.body.password, 8),
            name: req.body.name,
            company: req.body.company,
            Phone: req.body.Phone,
            businessType: req.body.businessType,
            usDotNumber: req.body.usDotNumber,
            mcNumber: req.body.mcNumber,
            isActive: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        user.id = user._id.toString();
        await user.save();
        await SettingsModel.create({
            userId: user.id,
            shiftName: "Weekly",
            filters: {
                loadsFilters: {},
                capacityFilters: {},
                matchingFilters: {}
            },
            listFilters: {
                loadsFilters: [],
                capacityFilters: [],
                matchingFilters: []
            }
        });

        await Promise.all([
            sendEmailToUser(user),
            sendEmailToOffice(user)
        ]);

        return res.send(getResponse(1, "User successfully registered"));
    } catch (err) {
        res.status(500).send({ msg: "User create error", err: err });
    }
};

// sign in
exports.signIn = async (req, res) => {
    try {
        const userMin = {
            id: req.user.id,
            name: req.user.name,
            username: req.user.username,
            email: req.user.email,
            type: req.user.type || '',
            Phone: req.user.Phone
        };
        const token = jwt.sign({ user: userMin, jwtUUID: config.jwtUUID }, config.secret, {
            expiresIn: config.jwtExpire // expires in 31 day default
        });
        const authorities = [];
        const response = {
            auth: true,
            status: 1,
            accessToken: token,
            username: userMin.username,
            userId: userMin.id,
            userType: userMin.type,
            ttt: userMin.type,
            phone: userMin.Phone,
            name: userMin.name,
            email: userMin.email,
            authorities: authorities
        };

        tokenList[token] = response;

        res.status(200).send(response);
    } catch (err) {
        res.status(500).send({
            msg: err.message,
            auth: false,
            status: 0
        });
    }
};

// sign out
exports.signOut = async (req, res) => {
    try {
        const result = await User.updateOne({
            _id: new mongo.ObjectID(req.user.id)
        }, {
            logoutAt: Date.now()
        });

        if (result.n != 1) {
            return res.status(409).json({
                status: 0,
                msg: 'SignOut error'
            });
        }

        res.json({
            status: 1,
            msg: "SignOut"
        });
    } catch (err) {
        res.status(500).send({
            status: 0,
            msg: err.message
        });
    }
};

// change password
exports.changePassword = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(404).send({ status: 0, msg: 'User Not Found.', reason: 'User Not Found.' });
        }

        var passwordIsValid = bcrypt.compareSync(req.body.passwordOld, req.user.password);
        if (!passwordIsValid) {
            return res.status(409).send({ status: 0, msg: 'Invalid Password!', reason: 'Invalid Password!', auth: false, accessToken: null });
        }

        const updatedUser = await User.updateOne({ _id: req.user._id }, {
            password: bcrypt.hashSync(req.body.passwordNew, 8)
            // changePasswordAt: Date.now()
        });

        if (updatedUser.n != 1) {
            return res.status(500).send({ status: 0, msg: 'Error during password change.', reason: 'Error during password change.' });
        }

        // res
        res.status(200).send({
            username: req.user.username,
            msg: 'Password was changed successfully'
        });
    } catch (err) {
        res.status(500).send({ reason: err.message });
    }
};

async function sendActivationEmailToUser(user, html) {
    console.log(user.email);
    let subject = `GetFlatbeds Platform ${user.username} activation`;

    let text = `
    Your account has been activated. \r\n
    Username: ${user.username}  \r\n
    Login: https://app.getflatbeds.com/login?returnUrl=%2Floadboards`;
    
    if (!!html) { text = html };

    await Mailer.sendMail(user.email, subject, text);
}

async function sendEmailToUser(user) {
    let subject = `GetFlatbeds Platform ${user.type} registration`;
    let text = `
        Welcome aboard, ${user.name}!\r\n
        You are in activation process. It would take a little time.\r\n
        If you didn't try to sign up, don't worry. You can safely ignore this email.`;
    await Mailer.sendMail(user.email, subject, text);
}

async function sendEmailToOffice(user) {
    let subject = `New user registration ${user.type}`;
    const usDotNumber = user.type == 'courier' || user.type == 'carrier' ? `US Dot Number: ${user.usDotNumber}\r\n` : ''
    let text = `
        Type: ${user.type}\r\n
        Name: ${user.name}\r\n
        User Name: ${user.username}\r\n
        Email: ${user.email}\r\n
        Phone: ${user.Phone}\r\n
        Company: ${user.company}\r\n
        ${usDotNumber}
        Business Type: ${user.businessType}`;
    await Mailer.sendMail(config.infoEmail, subject, text);
}