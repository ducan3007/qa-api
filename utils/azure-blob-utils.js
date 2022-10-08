const {
  BlobServiceClient,
  BlockBlobClient,
  getBlobName,
} = require("@azure/storage-blob");
require("dotenv").config();

// import pkg from "@azure/storage-blob";
// import "dotenv/config";
// import { v4 as uuidv4 } from "uuid";

// const intoStream = require("into-stream");

const { Readable } = require("stream");

// import intoStream from "into-stream";

// const { BlobServiceClient, BlockBlobClient, getBlobName } = pkg;

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerCient = blobServiceClient.getContainerClient("app-image");

const uploadFile = async (file) => {
  // const blobName = uuidv4();
  try {
    const BlobService = new BlockBlobClient(
      process.env.AZURE_STORAGE_CONNECTION_STRING,
      "app-image",
      file?.originalname
    );

    const stream = Readable.from(file?.buffer);
    const streamLength = file.buffer.length;

    console.log("Uploading to Azure storage as blob:\n\t", file);

    const blobOption = {
      blobHTTPHeaders: {
        blobContentType: file?.mimetype,
      },
    };

    console.log("blobOption", blobOption);

    await BlobService.uploadStream(stream, streamLength, undefined, {
      blobHTTPHeaders: {
        blobContentType: file?.mimetype,
      },
    });
    return {
      url: `https://azurestorageasian.blob.core.windows.net/app-image/${file?.originalname}`,
      key: file?.originalname,
    };
  } catch (error) {
    console.log(error);
  }
};

module.exports = {
  uploadFile,
};
