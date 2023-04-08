const fs = require('fs');
const mime = require('mime-types');
const FtpSrv = require('ftp-srv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const ftpUrl = 'ftp://0.0.0.0:2121'

const ftpServer = new FtpSrv({ 
  url: ftpUrl,
  pasv_url: ftpUrl,
  anonymous: true,
  greeting: ["Welcome to my FTP server"]
});

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://c29995405b59aacd0660945b6c91d13d.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: '00bb7f585538c0585db61bb2989ea92f',
    secretAccessKey: '690cb8f5cfc69c6a96f9bfa20ce63508d4b8f3ec73360481dc717fc4ace79e7e',
  },
});

async function uploadFileToS3(fileName, fileStream, retries = 3) {
  try {
    const command = new PutObjectCommand({
      Bucket: 'airphoto',
      Key: fileName,
      Body: fileStream,
      ContentType: mime.contentType(fileName)
    });

    await s3Client.send(command);
  } catch (error) {
    if (retries > 0) {
      console.error(`Error uploading file to R2/S3, ${retries} retries left: ${error}`);
      await uploadFileToS3(filename, fileStream, retries - 1);
    } else {
      throw error;
    }
  }
}

ftpServer.on('login', ({ connection }, resolve, reject) => {
  console.log('login: client connected')

  connection.on('STOR', async (error, filePath) => {    
    let fileName = filePath.split('/').at(-1);

    if(error) {
      console.error(`Error getting file ${error}`);
      return;
    }

    const fileStream = fs.createReadStream(filePath)

    try {
      await uploadFileToS3(fileName, fileStream);
      console.log('uploaded image to R2/S3')
      return;
    } 
    catch (error) {
      console.error(`Error uploading file to R2/S3: ${error}`);
      return;
    }
  });

  resolve({ root: './' }); // set root directory
});

ftpServer.on('disconnect', ({connection, id, newConnectionCount}) => { console.log('client disconnected') });

ftpServer.on('client-error', (connection, context, error) => {
  console.error(`Client error: ${error}`);
});

ftpServer.listen()
  .then(() => console.log('FTP server started'))
  .catch(error => console.error(`Error starting FTP server: ${error}`));
