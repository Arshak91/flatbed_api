
// global responce data
module.exports = function getResponse(status, msg, data) {
    return {
        status,
        msg,
        data,
        data: data || null
    }
};

