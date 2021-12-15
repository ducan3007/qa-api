const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const responseHandler = require("../utils/response");
const fetchTagDesc = require("../utils/fetchTagDesc");
const Comment = require("./comments");
const Tags = require("./tags");
const voteSchema = require("./vote");

const postSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    body: {
        type: String,
        required: true,
    },
    tagname: [{
        type: String,
        require: true,
    }, ],
    comments: [Comment],
    answers: [{
        type: Schema.Types.ObjectId,
        ref: "answers",
        required: false,
    }, ],
    votes: [voteSchema],
    views: {
        type: Number,
        default: 0,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
});
postSchema.set("toJSON", { getters: true });

postSchema.options.toJSON.transform = (doc, ret) => {
    const obj = {...ret };
    delete obj._id;
    delete obj.__v;
    return obj;
};

const Post = (module.exports = mongoose.model("posts", postSchema));

const formatResult = (result) => {
    return result.map((doc) => {
        const obj = {};
        obj.id = doc._id;
        if (doc.user_id._id) {
            obj.user_id = doc.user_id._id;
        } else {
            obj.user_id = doc.user_id;
        }

        if (doc.Author) {
            obj.username = doc.Author[0].username;
        } else {
            obj.username = doc.user_id.username;
        }
        obj.title = doc.title;

        obj.body = doc.body;
        obj.tagname = doc.tagname;
        obj.votes = doc.votes;
        obj.answer_count = doc.answers != undefined ? doc.answers.length : 0;
        obj.views = doc.views;
        obj.created_at = doc.created_at;

        return obj;

    });
};
module.exports.createPost = (req, result) => {
    const tags = req.body.tagname.toString().split(/[,]+/);

    let tagnames = tags.filter((tag, pos) => {
        if (tag != "") {
            return tags.indexOf(tag) == pos;
        }
    });
    try {
        const options = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        };
        const promises = tagnames.map(async(tag) => {
            try {
                const tagfound = await Tags.findOne({
                    $and: [
                        { tagname: encodeURIComponent(tag) },
                        { description: { $exists: true } },
                        { description: { $ne: "" } },
                    ],
                }, { _id: 1 });
                if (tagfound) {
                    return;
                } else {
                    return fetchTagDesc.fetchTagDescription(encodeURIComponent(tag));
                }
            } catch (err) {
                console.log(err);
            }
        });
        Promise.all(promises).then(async(results) => {
            for (let i = 0; i < tagnames.length; i++) {
                tagnames[i] = tagnames[i];
                if (results[i] === null) {
                    try {
                        await Tags.findOneAndUpdate({ tagname: tagnames[i] }, {
                                $inc: {
                                    posts_count: 1,
                                },
                            },
                            options
                        );
                    } catch (err) {
                        console.log(err);
                    }
                } else {
                    try {
                        await Tags.findOneAndUpdate({ tagname: tagnames[i] }, {
                                $inc: {
                                    posts_count: 1,
                                },
                                $set: {
                                    description: results[i],
                                },
                            },
                            options
                        );
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
            try {
                const addPost = await Post.create({
                    title: req.body.title,
                    user_id: req.user.id,
                    body: req.body.body,
                    tagname: tagnames,
                });
                if (addPost) {
                    result(
                        null,
                        responseHandler.response(
                            true,
                            200,
                            "Post Created successfully",
                            addPost._id
                        )
                    );
                }
            } catch (err) {
                console.log(err);
            }
        });
    } catch (err) {
        result(responseHandler.response(false, 500, "Server Error", null), null);
    }
};
module.exports.addPostComment = (req, results) => {
    try {
        const comment = {
            body: req.body.body,
            Author: req.user.id,
            post_id: req.params.post_id,
        };

        Post.findOneAndUpdate({ _id: req.params.post_id }, { $push: { comments: comment } })
            .then((result) => {
                results(
                    null,
                    responseHandler.response(
                        true,
                        200,
                        "Comment added successfully",
                        result._id
                    )
                );
            })
            .catch((err) => {
                results(
                    responseHandler.response(false, 400, "add comment failed", null),
                    null
                );
            });
    } catch (err) {
        results(responseHandler.response(false, 500, "Server Error", null), null);
    }
};
module.exports.getPostComments = (req, results) => {
    try {
        const postId = req.params.post_id;

        // Post.aggregate([{
        //         $match: {
        //             _id: mongoose.Types.ObjectId(postId),
        //         }
        //     },
        //     {
        //         $project: {
        //             comments: 1
        //         }
        //     },
        //     {
        //         $lookup: {
        //             from: "users",
        //             localField: "comments.Author",
        //             foreignField: "_id",
        //             as: "Author",
        //         },
        //     },
        //  {
        //     $match: {
        //         "Author.active": true
        //     }

        // },
        // {
        //     $project: {
        //         _id: 1,
        //         title: 1,
        //         user_id: 1,
        //         body: 1,
        //         tagname: 1,
        //         answers: 1,
        //         votes: 1,
        //         created_at: 1,
        //         views: 1,
        //         "Author._id": 1,
        //         "Author.username": 1
        //     }
        // }
        // ]).then((result) => {
        //     results(
        //         null,
        //         responseHandler.response(true, 200, "successfully", result)
        //     );
        // })

        Post.findById({ _id: postId }, { comments: 1 })
            .populate("comments.Author", "username active")
            .lean()
            .then((result) => {
                const obj = [];
                for (let a of result.comments) {
                    if (a.Author.active === true) {
                        obj.push({
                            id: a._id,
                            user_id: a.Author._id,
                            username: a.Author.username,
                            body: a.body,
                            post_id: a.post_id,
                            created_at: a.created_at
                        })
                    }
                }
                results(
                    null,
                    responseHandler.response(true, 200, "successfully", obj)
                );

            })
            .catch((err) => {
                results(responseHandler.response(false, 404, "Not found", null), null);
            });
    } catch {

    }

};

module.exports.getPosts = (req, results) => {
    let page = req.query.page;
    if (page == undefined) {
        page = 1;
    }
    if (req.query.search != "null" && req.query.search != undefined) {
        // regex is not allowed in free Atlas tier
        Post.aggregate([{
                $search: {
                    index: "post_full_textsearch",
                    text: {
                        query: decodeURIComponent(req.query.search),
                        path: ["title", "body", "tagname"],
                    },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "Author",
                },
            },
            {
                $match: {
                    "Author.active": true
                }
            },
            {
                $sort: {
                    created_at: -1,
                },
            },
            {
                $skip: 5 * (page - 1),
            },
            {
                $limit: 5,
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    user_id: 1,
                    body: 1,
                    tagname: 1,
                    answers: 1,
                    votes: 1,
                    comments: 1,
                    created_at: 1,
                    views: 1,
                    "Author._id": 1,
                    "Author.username": 1,
                },
            },
        ]).then(async(result) => {

            let total = await Post.aggregate([{
                    $search: {
                        index: "post_full_textsearch",
                        text: {
                            query: decodeURIComponent(req.query.search),
                            path: ["title", "body", "tagname"],
                        },
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "Author",
                    },
                },
                {
                    $match: {
                        "Author.active": true
                    }
                },
                {
                    $count: "result_count",
                },
            ]);

            if (total[0] === undefined || total === undefined) {
                results(
                    null,
                    responseHandler.response(true, 200, "successfully", [
                        { totalPost: 0 },
                    ])
                );
            } else {
                result = formatResult(result);
                result[0].totalPost = total[0].result_count;
                results(
                    null,
                    responseHandler.response(true, 200, "successfully", result)
                );
            }
        });
    } else if (req.params.tagname) {
        Post.aggregate([{
                    $match: {
                        tagname: decodeURIComponent(req.params.tagname)
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "Author",
                    },
                },
                {
                    $match: {
                        "Author.active": true
                    }
                },
                {
                    $sort: {
                        created_at: -1,
                    },
                },
                {
                    $skip: 5 * (page - 1),
                },
                {
                    $limit: 5,
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        user_id: 1,
                        body: 1,
                        tagname: 1,
                        answers: 1,
                        votes: 1,
                        comments: 1,
                        created_at: 1,
                        views: 1,
                        "Author._id": 1,
                        "Author.username": 1,
                    },
                },
            ]).then(async(result) => {
                let total = await Post.aggregate([{
                        $match: {
                            tagname: decodeURIComponent(req.params.tagname)
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "user_id",
                            foreignField: "_id",
                            as: "Author",
                        },
                    },
                    {
                        $match: {
                            "Author.active": true
                        }
                    }, {
                        $count: "result_count",
                    }
                ])

                if (total[0] === undefined || total === undefined) {
                    results(
                        null,
                        responseHandler.response(true, 200, "successfully", [
                            { totalPost: 0 },
                        ])
                    );
                } else {
                    result = formatResult(result);
                    result[0].totalPost = total[0].result_count;
                    results(
                        null,
                        responseHandler.response(true, 200, "successfully", result)
                    );
                }
            })
            .catch((err) => {
                console.log(err);
            });
    } else {
        if (req.url.includes("top")) {
            Post.aggregate([{
                        $lookup: {
                            from: "users",
                            localField: "user_id",
                            foreignField: "_id",
                            as: "Author",
                        },
                    },
                    {
                        $match: {
                            "Author.active": true
                        }
                    },
                    {
                        $sort: {
                            created_at: -1,
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            user_id: 1,
                            body: 1,
                            tagname: 1,
                            answers: 1,
                            votes: 1,
                            created_at: 1,
                            views: 1,
                            "Author._id": 1,
                            "Author.username": 1,
                        },
                    },
                ]).then((result) => {
                    result = formatResult(result);
                    result = result.sort((a, b) => {
                        return b.answer_count - a.answer_count != 0 ?
                            b.answer_count - a.answer_count :
                            b.views - a.views != 0 ?
                            b.views - a.views :
                            b.comment_count - a.comment_count;
                    });
                    result = result.slice(0, 12);
                    results(
                        null,
                        responseHandler.response(true, 200, "successfully", result)
                    );
                })
                .catch((err) => {
                    console.log(err);
                    results(
                        responseHandler.response(false, 400, "Post not found", null),
                        null
                    );
                });
        } else if (page) {
            Post.aggregate([{
                        $lookup: {
                            from: "users",
                            localField: "user_id",
                            foreignField: "_id",
                            as: "Author",
                        },
                    },
                    {
                        $match: {
                            "Author.active": true
                        }
                    },
                    {
                        $sort: {
                            created_at: -1,
                        },
                    },
                    {
                        $skip: 5 * (page - 1),
                    },
                    {
                        $limit: 5,
                    },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            user_id: 1,
                            body: 1,
                            tagname: 1,
                            answers: 1,
                            votes: 1,
                            created_at: 1,
                            views: 1,
                            "Author._id": 1,
                            "Author.username": 1,
                        },
                    },
                ]).then(async(result) => {
                    console.log("ddddddddddd")
                        // results(
                        //     null,
                        //     responseHandler.response(true, 200, "successfully", result)
                        // );

                    let total = await Post.aggregate([{
                            $lookup: {
                                from: "users",
                                localField: "user_id",
                                foreignField: "_id",
                                as: "Author",
                            },
                        },
                        {
                            $match: {
                                "Author.active": true
                            }
                        },
                        {
                            $count: "result_count",
                        },
                    ]);
                    if (total[0] === undefined || total === undefined) {
                        results(
                            null,
                            responseHandler.response(true, 200, "successfully", [
                                { totalPost: 0 },
                            ])
                        );
                    } else {
                        result = formatResult(result);
                        result[0].totalPost = total[0].result_count;
                        results(
                            null,
                            responseHandler.response(true, 200, "successfully", result)
                        );
                    }
                })
                .catch((err) => {
                    console.log(err);
                    results(
                        responseHandler.response(false, 400, "Post not found", null),
                        null
                    );
                });



            // Post.find()
            //     .populate("user_id", "username")
            //     .sort("-created_at")
            //     .skip(5 * (page - 1))
            //     .limit(5)
            //     .lean()
            //     .then(async(result) => {
            //         console.log("ddddddddddd")
            //             // results(
            //             //     null,
            //             //     responseHandler.response(true, 200, "successfully", result)
            //             // );

            //         let total = await Post.find().count();
            //         result = formatResult(result);
            //         result[0].totalPost = total;
            //         results(
            //             null,
            //             responseHandler.response(true, 200, "successfully", result)
            //         );
            //     })
            //     .catch((err) => {
            //         console.log(err);
            //         results(
            //             responseHandler.response(false, 400, "Post not found", null),
            //             null
            //         );
            //     });
        }
    }
};
module.exports.getOnePost = (req, results) => {
    const postId = req.params.post_id;
    Post.findOneAndUpdate({ _id: postId }, {
        $inc: {
            views: 1,
        },
    }).then(() => {
        Post.aggregate([{
                    $match: {
                        _id: mongoose.Types.ObjectId(postId),
                    }
                }, {
                    $lookup: {
                        from: "users",
                        localField: "user_id",
                        foreignField: "_id",
                        as: "Author",
                    },
                },
                {
                    $match: {
                        "Author.active": true
                    }
                },
                {
                    $project: {
                        _id: 1,
                        title: 1,
                        user_id: 1,
                        body: 1,
                        tagname: 1,
                        answers: 1,
                        votes: 1,
                        created_at: 1,
                        views: 1,
                        "Author._id": 1,
                        "Author.username": 1
                    }
                }
            ]).then((doc) => {


                const obj = {};
                obj.id = doc[0]._id;
                obj.user_id = doc[0].Author[0]._id;
                obj.username = doc[0].Author[0].username;
                obj.title = doc[0].title;
                obj.body = doc[0].body;
                obj.tagname = doc[0].tagname;
                obj.answer_count = doc[0].answers != undefined ? doc[0].answers.length : 0;
                obj.votes = doc[0].votes;
                obj.views = doc[0].views;
                obj.created_at = doc[0].created_at;


                results(null, responseHandler.response(true, 200, "successfully", obj));

                // const obj = {};
                // obj.id = doc._id;
                // obj.user_id = doc.user_id._id;
                // obj.username = doc.user_id.username;
                // obj.title = doc.title;
                // obj.body = doc.body;
                // obj.tagname = doc.tagname;
                // obj.answer_count = doc.answers != undefined ? doc.answers.length : 0;
                // obj.votes = doc.votes;
                // obj.views = doc.views;
                // obj.created_at = doc.created_at;
                // results(null, responseHandler.response(true, 200, "successfully", obj));
            })
            .catch((err) => {

                results(responseHandler.response(false, 400, "not found", null), null);
            });
    }).catch((err) => {
        results(responseHandler.response(false, 404, "not found", null), null);
    });

};

module.exports.getUserPost = (req, results) => {
    try {
        Post.find({ user_id: req.params.id })
            .lean()
            .populate("user_id", "username")
            .populate("answers", "comments")
            .sort("-created_at")
            .lean()
            .then((result) => {
                result = result.map((doc) => {
                    const obj = {};
                    obj.id = doc._id;
                    obj.user_id = doc.user_id._id;
                    obj.username = doc.user_id.username;
                    obj.title = doc.title;
                    obj.body = doc.body;
                    obj.tagname = doc.tagname;
                    obj.votes = doc.votes;
                    obj.answer_count = doc.answers != undefined ? doc.answers.length : 0;
                    obj.comment_count =
                        doc.comments != undefined ? doc.comments.length : 0;
                    obj.views = doc.views;
                    obj.created_at = doc.created_at;
                    return obj;
                });
                results(
                    null,
                    responseHandler.response(true, 200, "successfully", result)
                );
            })
            .catch((err) => {
                results(responseHandler.response(false, 404, "Not found", null), null);
            });
    } catch (err) {
        results(responseHandler.response(false, 500, "Server Error", null), null);
    }
};

module.exports.deletePostComment = (req, results) => {
    Post.findOneAndUpdate({
            $and: [
                { _id: req.params.post_id },
                {
                    "comments._id": req.params.comment_id,
                },
                {
                    "comments.Author": req.user.id,
                },
            ],
        }, {
            $pull: { comments: { _id: req.params.comment_id } },
        })
        .then((result) => {
            if (result) {
                results(
                    null,
                    responseHandler.response(
                        true,
                        200,
                        "Delete comment successfully",
                        null
                    )
                );
            } else {
                results(
                    responseHandler.response(false, 404, "Comment Not found", null),
                    null
                );
            }
        })
        .catch((err) => {
            results(responseHandler.response(false, 404, "Not found", null), null);
        });
};
module.exports.vote = (req, results) => {
    try {
        const user_id = req.user.id;
        const score =
            req.params.action === "upvote" ?
            1 :
            req.params.action === "downvote" ?
            -1 :
            0;
        Post.updateOne({ $and: [{ _id: req.params.post_id }, { "votes.user_id": user_id }] }, { $set: { "votes.$.vote": score } })
            .lean()
            .then((aa) => {
                if (aa.modifiedCount === 0 && aa.matchedCount === 0) {
                    Post.updateOne({ _id: req.params.post_id }, { $push: { votes: { user_id: user_id, vote: score } } })
                        .then((result) => {
                            results(
                                null,
                                responseHandler.response(
                                    true,
                                    200,
                                    "Thanks for the feedback!",
                                    null
                                )
                            );
                        })
                        .catch((err) => {
                            console.log(err);
                            results(
                                responseHandler.response(false, 500, "Server Error", null),
                                null
                            );
                        });
                } else {
                    results(
                        null,
                        responseHandler.response(
                            true,
                            200,
                            "Thanks for the feedback!",
                            null
                        )
                    );
                }
            })
            .catch((err) => {
                console.log(err);
                results(
                    responseHandler.response(false, 500, "Server Error", null),
                    null
                );
            });
    } catch (err) {
        results(responseHandler.response(false, 500, "Server Error", null), null);
    }
};