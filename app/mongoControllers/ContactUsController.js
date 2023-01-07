const mongo = require('mongodb');
const User = require('../mongoModels/UserModel');
const Mailer = require('../classes/mailer');
const getResponse = require('../helper');
const ContactUsTypes = {
    [1]: 'Issue',
    [2]: 'Question',
    [3]: 'Custom Change Request',
    [4]: 'Other'
};
exports.sendContactRequest = async (req, res) => {
    const { type, message } = req.body;
    const user = req.user;
    const messageText = `

    Phone number: ${user.Phone} \r\n
    Email: ${user.email} \r\n
    Username: ${!!user.username ? user.username : 'None'} \r\n

    ${ContactUsTypes[type]}:  \r\n
    ${message} \r\n`;

    await Mailer.sendMail('support@getflatbeds.com', ContactUsTypes[type], messageText, null, user.email);
    return res.send(getResponse(1,'Message successfully sent.' ));
};