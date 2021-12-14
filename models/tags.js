const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const sizeof = require("object-sizeof");
const responseHandler = require("../utils/response");
const tagsModel = new Schema({
    tagname: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        require: false,
    },
    posts_count: {
        type: Number,
        default: 0,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
}, { toJSON: { virtuals: true } });
tagsModel.set("toJSON", { getters: true });

tagsModel.options.toJSON.transform = (doc, ret) => {
    const obj = {...ret };
    delete obj._id;
    delete obj.__v;
    return obj;
};

const Tags = (module.exports = mongoose.model("tags", tagsModel));

module.exports.getTags = (req, results) => {
    let page = req.query.page;
    if (page === undefined) {
        page = 1;
    }
    if (req.url.includes("top")) {
        Tags.find()
            .sort("-posts_count")
            .limit(20)
            .then((result) => {
                results(null, responseHandler.response(true, 200, "Success", result));
            });
    } else {
        Tags.find()
            .skip(20 * (page - 1))
            .limit(20)
            .lean()
            .then(async(result) => {
                let a = await Tags.find().count();
                result = result.map((tag) => {
                    tag.id = tag._id;
                    delete tag._id;
                    return tag;
                });
                result[0].totalTags = a;
                results(null, responseHandler.response(true, 200, "Success", result));
            });
    }
};

module.exports.getOneTags = async(tagname, result) => {
    try {
        const res = await Tags.findOne({ tagname: decodeURIComponent(tagname) });
        if (!res) {
            result(responseHandler.response(false, 404, "Tag not found", null));
        }
        result(null, responseHandler.response(true, 200, "Success", res));
    } catch (err) {}
};