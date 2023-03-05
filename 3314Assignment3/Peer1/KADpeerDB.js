let net = require("net");
let singleton = require("./Singleton");
let handler = require("./PeersHandler");
let os = require("os");
let path = require("path");

singleton.init();


// get current folder name
let myFolderName = require("path")
  .dirname(require.main.filename)
  .split(path.sep)
  .pop()

let interfaces = os.networkInterfaces();
let HOST = "";
let PORT = 2001
singleton.setPort(PORT)
let imageHOST = '127.0.0.1'
let imagePORT = singleton.getImagePort();
let myImage = "Canna.gif"

// Fucntion here to get the loaclhost ip address
Object.keys(interfaces).forEach(function (ifname) {
  interfaces[ifname].forEach(function (iface) {
    if ("IPv4" == iface.family && iface.internal !== false) {
      HOST = iface.address;
    }
  });
});

let serverID = singleton.getPeerID(HOST, PORT);


if (process.argv.length > 2) {
  // call as node KADpeer [-p <serverIP>:<port>]

  // This peer will run as a client
  let firstFlag = process.argv[2];
  let hostserverIPandPort = process.argv[3].split(":");
  let knownHOST = hostserverIPandPort[0];
  let knownPORT = hostserverIPandPort[1];

  //Connecting to the known peer address (any peer act as a server)
  let clientSocket = new net.Socket();
  let port = singleton.getPort();

  // initialize client DHT table
  let clientID = singleton.getPeerID('127.0.0.1', PORT)
      
  let localKeyList = {//define our local image and generate its ID
    image: myImage, 
    imageID: singleton.getKeyID(myImage)
  }

  let clientPeer = {
    // client name
    peerName: myFolderName, 
    peerIP: '127.0.0.1',
    peerPort: PORT,
    peerID: clientID,
    peerImage: localKeyList,
    imageDBPort: imagePORT,
  };

  let clientDHTtable = {
    owner: clientPeer,
    table: []
  }


  let imageDB = net.createServer();
  imageDB.listen(imagePORT, imageHOST);
  console.log('ImageDB server is started at timestamp: '+singleton.getTimestamp()+' and is listening on ' + imageHOST + ':' + imagePORT);

  imageDB.on('connection', function(socket) {//on image db server connection
    
    handler.handleImageSocketJoining(socket, clientDHTtable); 
  });

  clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: port }, () => {

    handler.handleCommunications(clientSocket, myFolderName /*client name*/, clientDHTtable);
  });

} else {
  // call as node peer (no arguments)
  // run as a server

  let imageDB = net.createServer();
  imageDB.listen(imagePORT, imageHOST);
  console.log('ImageDB server is started at timestamp: '+singleton.getTimestamp()+' and is listening on ' + imageHOST + ':' + imagePORT);
  
  let serverSocket = net.createServer();
  serverSocket.listen(PORT, HOST);
  console.log("This peer address is " + HOST + ":" + PORT + " located at " + myFolderName + " [" + serverID + "]");

  // initialize server DHT table

  let localKeyList = {//set our own local Image and its ID
    image: myImage,
    imageID: singleton.getKeyID(myImage)
  }

  let serverPeer = {//server info
    peerName: myFolderName,
    peerIP: HOST,
    peerPort: PORT,
    peerID: serverID,
    peerImage: localKeyList,
    imageDBPort: imagePORT
  };

  let serverDHTtable = {//server DHT 
    owner: serverPeer,
    table: []
  }

  imageDB.on('connection', function(socket) {//on image db server connection
    
    handler.handleImageSocketJoining(socket, serverDHTtable); 
  });
  serverSocket.on("connection", function (sock) {
    // received connection request
    handler.handleClientJoining(sock, serverDHTtable, imageDB);
  });

}
