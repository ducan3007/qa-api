// import azure from "../utils/azure-blob-utils.js";
const azure = require("../utils/azure-blob-utils.js");
const responseHandler = require("../utils/response");
const AzureController = async (req, res) => {
  try {
    console.log(req.body);
    console.log(req.file);
    console.log(req.file.path);

    const uploadBlobResponse = await azure.uploadFile(req.file);

    // res.status(200).json(uploadBlobResponse);
    return res
      .status(200)
      .json(responseHandler.response(true, 200, "success", uploadBlobResponse));
  } catch (error) {
    console.log(error);
  }
};

module.exports = AzureController;
