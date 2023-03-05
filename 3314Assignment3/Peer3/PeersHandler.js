let net = require("net"),
  kadPTPpacket = require("./kadPTPmessage"),
  singleton = require("./Singleton");
let counter = 0;//so that only one client maintains connection with imageDB
let myReceivingPort = null;
let mySendingPort = null;
let cNo;

let peersList = [];

module.exports = {
  handleImageSocketJoining: function (socket, serverDHTtable) {
   
    if(counter<1){
      singleton.setClientPort(socket)
    }
    counter++;
    
    socket.on("data", function(data){
      if(parseBitPacket(data, 4, 8)==4){//if its an image response packet sent from another peer
        let sock = singleton.getClientPort()
        let newResponse = kadPTPpacket.editImagePacketResponse(data)       
        sock.write(newResponse)

      }else{//if its client joining for the first time
  
        if(parseBitPacket(data,0,4)==7&&parseBitPacket(data,24,8)==0){
  
          let imageName = parseClientITPRequest(data)
  
          if(serverDHTtable.owner.peerImage.imageID == singleton.getKeyID(imageName)){//if image is in our own folder
            socket.write(kadPTPpacket.getImagePacket(imageName))
          }else{//if image isn't within our own folder
  
            let closestPeer = getClosestPeer(serverDHTtable.table, serverDHTtable.owner.peerID)//find the closest peer
            let sender = serverDHTtable.owner.peerName;//set the sender of the search packet to our peer Name
            let searchPacket = kadPTPpacket.searchPacket(imageName, serverDHTtable, sender)//the actual packet to be sent
            let tempPeer = net.Socket()
            console.log("Sending kadPTP request message to "+closestPeer.peerIP+":"+closestPeer.peerPort)
            connectTempPeer(tempPeer, closestPeer.peerIP, closestPeer.peerPort, searchPacket)
            
          }
        }
      }
    });
    socket.on("close", function () {//once client exists, console log in server
      console.log("Client-"+cNo+" closed the connection")
  });
  },
  handleClientJoining: function (sock, serverDHTtable) {
    // accept anyways in this assignment
    handleClient(sock, serverDHTtable);

  },
  handleCommunications: function (clientSocket, clientName, clientDHTtable) {
     
    communicate(clientSocket, clientName, clientDHTtable)
  }
};

function handleClient(sock, serverDHTtable) {
  let kadPacket = null;
  let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort;

  // initialize client DHT table
  let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort)
  let joiningPeer = {
    peerName: "",
    peerIP: sock.remoteAddress,
    peerPort: sock.remotePort,
    peerID: joiningPeerID
  };

  // Triggered only when the client is sending kadPTP message
  sock.on('data', (message) => {

    if (parseBitPacket(message,4,8)==3){//if its a search packet
      let senderNameLength = parseBitPacket(message, 20, 12)//
      let payloadOffset = 80+senderNameLength*8
      let imgName = []

      for (let i = 0; i < parseBitPacket(message, payloadOffset+4, 28); i++) {
        imgName[i]=parseBitPacket(message,i*8+32+payloadOffset,8);//store image file name
      }

      let fullImage = bytes2string(imgName)+"."+getImageType(message, payloadOffset, 4).toLowerCase()//form the full image with the image extension
      if(serverDHTtable.owner.peerImage.imageID == singleton.getKeyID(fullImage)){//if the image is in server peer object (current folder)
        //create response
        let imageOffset = parseBitPacket(message, 20, 12)*8+32//where the image starts in the packet based on how long the sender name is
        let tempOriginIP = []//the parts of the IPV4 
        tempOriginIP[0] = parseBitPacket(message, imageOffset, 8)
        tempOriginIP[1] = parseBitPacket(message, imageOffset+8, 8)
        tempOriginIP[2] = parseBitPacket(message, imageOffset+16, 8)
        tempOriginIP[3] = parseBitPacket(message, imageOffset+24, 8)
        let originIP = tempOriginIP[0]+'.'+tempOriginIP[1]+'.'+tempOriginIP[2]+'.'+tempOriginIP[3]//combine the array to form IP
        let originPort = parseBitPacket(message, imageOffset+32, 16)
        let packet = kadPTPpacket.searchPacketResponse(fullImage)
        let tempPeer = net.Socket()
        console.log("Sending itp response message to "+originIP+":"+originPort)
        connectTempPeer(tempPeer, originIP, originPort, packet)//send the packet using this function
        
      }else{//if image isn't in current folder, find the closest peer in the network, and ask them for image
        
        let closestPeer = getClosestPeer(serverDHTtable.table, serverDHTtable.owner.peerID)//find the closest peer
        let sender = serverDHTtable.owner.peerName//set the sender
        let packet = kadPTPpacket.searchPacket(fullImage, serverDHTtable, sender)
        let tempPeer = net.Socket()
        console.log("Sending kadPTP request message to "+closestPeer.peerIP+":"+closestPeer.peerPort)
        connectTempPeer(tempPeer, closestPeer.peerIP, closestPeer.peerPort, packet)
      }



    }else if(Buffer.byteLength(message)>500){//if this is a search response packet with image payload
      
      let tempPeer = net.Socket()
      console.log("Sending itp response message to ImageDB server running on 127.0.0.1:"+serverDHTtable.owner.imageDBPort)
      connectTempPeer(tempPeer, '127.0.0.1', serverDHTtable.owner.imageDBPort, message)
    
    }else{
      kadPacket = parseMessage(message);
    }
    
  });

  sock.on('end', () => {
    // client edded the connection
    if (kadPacket) {
      // Here, the msgType cannot be 1. It can be 2 or greater
      if (kadPacket.msgType == 2) {
        console.log("Received Hello Message from " + kadPacket.senderName);

        if (kadPacket.peersList.length > 0) {
          let output = "  along with DHT: ";
          // now we can assign the peer name
          joiningPeer.peerName = kadPacket.senderName;
          for (var i = 0; i < kadPacket.peersList.length; i++) {
            output +=
              "[" +
              kadPacket.peersList[i].peerIP + ":" +
              kadPacket.peersList[i].peerPort + ", " +
              kadPacket.peersList[i].peerID +
              "]\n                  ";
          }
          console.log(output);
        }

        // add the sender into the table only if it is not exist or set the name of the exisiting one
        let exist = serverDHTtable.table.find(e => e.node.peerPort == joiningPeer.peerPort);
        if (exist) {
          exist.node.peerName = joiningPeer.peerName;
        } else {
          pushBucket(serverDHTtable, joiningPeer);
        }

        // Now update the DHT table
        updateDHTtable(serverDHTtable, kadPacket.peersList);
      }
    } else {
      // This was a bootstrap request
      console.log("Connected from peer " + joiningPeerAddress + "\n");
      // add the requester info into server DHT table
      pushBucket(serverDHTtable, joiningPeer);
    }
  });

  if (kadPacket == null) {
    // This is a bootstrap request
    // send acknowledgment to the client
    kadPTPpacket.init(7, 1, serverDHTtable);
    sock.write(kadPTPpacket.getPacket());
    sock.end();
  }
}

function communicate(clientSocket, clientName, clientDHTtable) {
  let senderPeerID = singleton.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort)

  clientSocket.on('data', (message) => {
    let kadPacket = parseMessage(message);

    let senderPeerName = kadPacket.senderName;
    let senderPeer = {
      peerName: senderPeerName,
      peerIP: clientSocket.remoteAddress,
      peerPort: clientSocket.remotePort,
      peerID: senderPeerID
    };

    if (kadPacket.msgType == 1) {
      // This message comes from the server
      console.log(
        "Connected to " +
        senderPeerName +
        ":" +
        clientSocket.remotePort +
        " at timestamp: " +
        singleton.getTimestamp() + "\n"
      );

      // Now run as a server
      myReceivingPort = singleton.getPort();
      let localPeerID = singleton.getPeerID(clientSocket.localAddress, myReceivingPort);
      let serverPeer = net.createServer();
      serverPeer.listen(myReceivingPort, clientSocket.localAddress);
      console.log(
        "This peer address is " +
        clientSocket.localAddress +
        ":" +
        myReceivingPort +
        " located at " +
        clientName +
        " [" + localPeerID + "]\n"
      );

      // Wait for other peers to connect
      serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock, clientDHTtable);
      });

      console.log("Received Welcome message from " + senderPeerName) + "\n";
      if (kadPacket.peersList.length > 0) {
        let output = "  along with DHT: ";
        for (var i = 0; i < kadPacket.peersList.length; i++) {
          output +=
            "[" +
            kadPacket.peersList[i].peerIP + ":" +
            kadPacket.peersList[i].peerPort + ", " +
            kadPacket.peersList[i].peerID +
            "]\n                  ";
        }
        console.log(output);
      } else {
        console.log("  along with DHT: []\n");
      }

      // add the bootstrap node into the DHT table but only if it is not exist already
      let exist = clientDHTtable.table.find(e => e.node.peerPort == clientSocket.remotePort);
      if (!exist) {
        pushBucket(clientDHTtable, senderPeer);
      } else {
        console.log(senderPeer.peerPort + " is exist already")
      }

      updateDHTtable(clientDHTtable, kadPacket.peersList)

    } else {
      // Later we will consider other message types.
      console.log("The message type " + kadPacket.msgType + " is not supported")
    }
  });

  clientSocket.on("end", () => {
    // disconnected from server
    sendHello(clientDHTtable)
  })
}

function updateDHTtable(DHTtable, list) {
  // Refresh the local k-buckets using the transmitted list of peers. 

  refreshBucket(DHTtable, list)
  console.log("Refresh k-Bucket operation is performed.\n");

  if (DHTtable.table.length > 0) {
    let output = "My DHT: ";
    for (var i = 0; i < DHTtable.table.length; i++) {
      output +=
        "[" +
        DHTtable.table[i].node.peerIP + ":" +
        DHTtable.table[i].node.peerPort + ", " +
        DHTtable.table[i].node.peerID +
        "]\n        ";
    }
    console.log(output);
  }

}

function parseMessage(message) {
  let kadPacket = {}
  peersList = [];
  let bitMarker = 0;
  kadPacket.version = parseBitPacket(message, 0, 4);
  bitMarker += 4;
  kadPacket.msgType = parseBitPacket(message, 4, 8);
  bitMarker += 8;
  let numberOfPeers = parseBitPacket(message, 12, 8);
  bitMarker += 8;
  let SenderNameSize = parseBitPacket(message, 20, 12);
  bitMarker += 12;
  kadPacket.senderName = bytes2string(message.slice(4, SenderNameSize + 4));
  bitMarker += SenderNameSize * 8;

  if (numberOfPeers > 0) {
    for (var i = 0; i < numberOfPeers; i++) {
      let firstOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let secondOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let thirdOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let forthOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8;
      let port = parseBitPacket(message, bitMarker, 16);
      bitMarker += 16;
      let IP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
      let peerID = singleton.getPeerID(IP, port);
      let aPeer = {
        peerIP: IP,
        peerPort: port,
        peerID: peerID
      };
      peersList.push(aPeer);
    }
  }
  kadPacket.peersList = peersList;
  return kadPacket;
}

function refreshBucket(T, peersList) {
  peersList.forEach(P => {
    pushBucket(T, P);
  });
}

// pushBucket method stores the peer’s information (IP address, port number, and peer ID) 
// into the appropriate k-bucket of the DHTtable. 
function pushBucket(T, P) {
  // First make sure that the given peer is not the loacl peer itself, then  
  // determine the prefix i which is the maximum number of the leftmost bits shared between  
  // peerID the owner of the DHTtable and the given peer ID. 

  if (T.owner.peerID != P.peerID) {
    let localID = singleton.Hex2Bin(T.owner.peerID);
    let receiverID = singleton.Hex2Bin(P.peerID);
    // Count how many bits match
    let i = 0;
    for (i = 0; i < localID.length; i++) {
      if (localID[i] != receiverID[i])
        break;
    }

    let k_bucket = {
      prefix: i,
      node: P
    };

    let exist = T.table.find(e => e.prefix === i);
    if (exist) {
      // insert the closest 
      if (singleton.XORing(localID, singleton.Hex2Bin(k_bucket.node.peerID)) <
        singleton.XORing(localID, singleton.Hex2Bin(exist.node.peerID))) {
        // remove the existing one
        for (var k = 0; k < T.table.length; k++) {
          if (T.table[k].node.peerID == exist.node.peerID) {
            console.log("** The peer " + exist.node.peerID + " is removed and\n** The peer " + 
            k_bucket.node.peerID + " is added instead")
            T.table.splice(k, 1);
            break;
          }
        }
        // add the new one    
        T.table.push(k_bucket);
      }
    } else {
      T.table.push(k_bucket);
    }
  }

}


// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time. 
function sendHello(T) {
  let i = 0;
  // we use echoPeer method to do recursive method calls
  echoPeer(T, i);
}

// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
function echoPeer(T, i) {
  setTimeout(() => {
    let sock = new net.Socket();
    sock.connect(
      {
        port: T.table[i].node.peerPort,
        host: T.table[i].node.peerIP,
        localPort: T.owner.peerPort
      },
      () => {
        // send Hello packet 
        kadPTPpacket.init(7, 2, T);
        sock.write(kadPTPpacket.getPacket());
        setTimeout(() => {
          sock.end();
          sock.destroy();
        }, 500)
      }
    );
    sock.on('close', () => {
      i++;
      if (i < T.table.length) {
        echoPeer(T, i)
      }
    })
    if (i == T.table.length - 1) {
      console.log("Hello packet has been sent.\n");
    }
  }, 500)
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}
function parseClientITPRequest (data){
  cNo = singleton.getTimestamp();
      let imageName=[];
      let imageType=getImageType(data, 64, 4)

      for (let i=0; i<parseBitPacket(data,68,28); i++)//returns integer array of image name so it can be converted to a string
          imageName[i]=parseBitPacket(data,96+i*8,8);

      imageName = bytes2string(imageName) //convert the imageName in bytes -> string

      clientRequest(data, cNo, imageType, imageName)//output client request
      
      return imageName+="."+imageType.toLowerCase()

}
function getImageType(data, offset, length){//returns image type
  let imageType;
  switch(parseBitPacket(data,offset, length)){
      case 1: imageType = "BMP"; break;
      case 2: imageType = "JPEG"; break;
      case 3: imageType = "GIF"; break;
      case 4: imageType = "PNG"; break;
      case 5: imageType = "TIFF"; break;
      case 15: imageType = "RAW"; break;
  }        

  return imageType;
}
function getRequestType(data){// returns request type
  let rType;
  switch(parseBitPacket(data,4,20)){
      case 1: rType = "Found"; break;
      case 2: rType = "Not Found"; break;
      case 3: rType = "Busy"; break;
      default: rType = "Query"
  }

  return rType;    
}
function clientRequest(data, cNo, imageType, imageName){
  console.log("Client-"+cNo+" is connect at timestamp: "+cNo)
      console.log("\nITP packet received: \n")
      printPacketBit(data)//convert packet -> bits and output

      console.log("\nClient-"+cNo+" requests:")
      console.log("\t--ITP Version: "+parseBitPacket(data, 0, 4))
      console.log("\t--Timestamp: "+parseBitPacket(data, 32, 32))
      console.log("\t--Request Type: "+getRequestType(data))
      console.log("\t--Image file extension(s): "+imageType)
      console.log("\t--Image File Name: "+imageName)
}

function getClosestPeer(peerList, currentKey){
  let closestPeer = {
    peerIP: null, 
    peerPort: null
  };
  for(i in peerList){
    if(peerList[i]){//skip over the empty positions in array
      if(closestPeer.peerPort == null){
        closestPeer=peerList[i].node
      }else{
        if(singleton.XORing(singleton.Hex2Bin(peerList[i].node.peerID), singleton.Hex2Bin(currentKey)) < singleton.XORing(singleton.Hex2Bin(closestPeer.peerID), singleton.Hex2Bin(currentKey))){
          closestPeer=peerList[i].node//if the peer at the position i is closer to our peer than the set closestPeer, replace it
        }
      }
    }

  }
  return closestPeer
}

function connectTempPeer(socket, host, port, packet){
  socket.connect(port, host, function () {
   socket.write(packet)
  })

}
function printPacketBit(packet) {
  var bitString = "";

  for (var i = 0; i < packet.length; i++) {
    // To add leading zeros
    var b = "00000000" + packet[i].toString(2);
    // To print 4 bytes per line
    if (i > 0 && i % 4 == 0) bitString += "\n";
    bitString += " " + b.substr(b.length - 8);
  }
  console.log(bitString);
}


