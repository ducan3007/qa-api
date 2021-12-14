const Tag = require("../models/tags");
const responseHandler = require("../utils/response");

const getTags = (req, res) => {
    try {
        Tag.getTags(req, (err, data) => {
            if (err) {
                console.log(err);
                return res.status(err.code).json(err);
            }
            return res.status(data.code).json(data);
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .json(responseHandler.response(false, 500, "sever erro", null));
    }
};
const getOneTag = (req, res) => {
    try {
        Tag.getOneTags(req.params.tagname, (err, data) => {
            if (err) {
                console.log(err);
                return res.status(err.code).json(err);
            }
            return res.status(data.code).json(data);
        });
    } catch (err) {
        console.log(err);
        return res
            .status(500)
            .json(responseHandler.response(false, 500, "sever error", null));
    }
};
module.exports = tagsController = {
    getTags,
    getOneTag,
};