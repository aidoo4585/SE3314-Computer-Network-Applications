let fs = require('fs');
let singleton = require('./Singleton')
//size of the response packet header:
let HEADER_SIZE = 4;

//Fields that compose the header
let version, messageType;

module.exports = {
  message: "", //Bitstream of the cPTP header

  init: function (ver, msgType, peerTable) {
    //fill out the default header fields:   
    let noOfPeers = peerTable.table.length,
      version = ver;

    //fill changing header fields:
    messageType = msgType;

    let senderName = stringToBytes(peerTable.owner.peerName);

    //build the header bistream:
    //--------------------------
    this.message = new Buffer.alloc(HEADER_SIZE + senderName.length + noOfPeers * 6);

    //fill out the header array of byte with PTP header fields
    // V
    storeBitPacket(this.message, version * 1, 0, 4);

    // Message type
    storeBitPacket(this.message, messageType, 4, 8);

    // Number of peers
    storeBitPacket(this.message, noOfPeers, 12, 8);

    // Sender name size
    storeBitPacket(this.message, senderName.length, 20, 12);
    let byteMarker = 4;

    // Sender name
    let j = 0;
    let i = 0;
    for (i = byteMarker; i < senderName.length + byteMarker; i++) {
      this.message[i] = senderName[j++];
    }

    // if number of peer not zero
    if (noOfPeers > 0) {
      let bitMarker = i * 8; // current bit position

      for (var k = 0; k < noOfPeers; k++) {
        let IP = peerTable.table[k].node.peerIP;
        let port = peerTable.table[k].node.peerPort;
        let firstOctet = IP.split(".")[0];
        let secondOctet = IP.split(".")[1];
        let thirdOctet = IP.split(".")[2];
        let forthOctet = IP.split(".")[3];

        storeBitPacket(this.message, firstOctet * 1, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, secondOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, thirdOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, forthOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, port, bitMarker, 16);
        bitMarker += 16;
      }
    }
  },

  //--------------------------
  //getpacket: returns the entire packet
  //--------------------------
  getPacket: function () {
    return this.message;
  },

  getImagePacket: function (image) {
    let imageName="./"+image
    let packet = Buffer.alloc(12);
    storeBitPacket(packet,7,0,4);

    storeBitPacket(packet,1,4,8);//store response
    storeBitPacket(packet,fs.statSync(imageName).size,64,32);
    
    let payload = fs.readFileSync(imageName);
    storeBitPacket(packet,singleton.getSequenceNumber(),12,20);//store sequence number
    storeBitPacket(packet,singleton.getTimestamp(),32,32);//store time stamp    
    
    return Buffer.concat([packet,payload]);
  }, 
  searchPacket: function (imageWithExtension, dht, sender) {
    let image = imageWithExtension.split(".")
    let packet = Buffer.alloc(10+Buffer.from(sender).length);
    let payload = Buffer.alloc(4+Buffer.from(image[0]).length);
    let originIP = dht.owner.peerIP.split(".")
    let originPort = dht.owner.peerPort

    storeBitPacket(packet, 7, 0, 4)//version 7
    storeBitPacket(packet, 3, 4, 8)//search
    storeBitPacket(packet, 0, 12, 20)//reserved
    storeBitPacket(packet, Buffer.from(sender).length, 20, 12)//sender name length
    let senderName=stringToBytes(sender)//convert sender name to bytes form
    let senderOffset = 32
    for (let i = 0; i < senderName.length; i++){
      storeBitPacket(packet,senderName[i],senderOffset,8);//store sender name in packet
      senderOffset+=8
    }
    storeBitPacket(packet, parseInt(originIP[0]), senderOffset, 8)//origin peerIPV4
    storeBitPacket(packet, parseInt(originIP[1]), senderOffset+8, 8)//origin peerIPV4
    storeBitPacket(packet, parseInt(originIP[2]), senderOffset+16, 8)//origin peerIPV4
    storeBitPacket(packet, parseInt(originIP[3]), senderOffset+24, 8)//origin peerIPV4
    storeBitPacket(packet, originPort, senderOffset+32, 16)//origin peer port
   
    storeBitPacket(payload, getImageType(image[1]), 0, 4)//store extension
    storeBitPacket(payload,Buffer.from(image[0]).length,4,28);//store image size
    let imageInBytes = stringToBytes(image[0]);
    let offset = 32;
    for (let i = 0; i < imageInBytes.length; i++) {
      storeBitPacket(payload,imageInBytes[i],i*8+offset,8);//store image file name
    }

      return Buffer.concat([packet,payload])

  }, 

  searchPacketResponse: function (fullImage) {
    let image="./"+fullImage
        let packet = Buffer.alloc(12);
        var payload;
        storeBitPacket(packet,7,0,4);
  
        storeBitPacket(packet,4,4,8);//store response
        storeBitPacket(packet,singleton.getSequenceNumber(),12,20);//store sequence number
        storeBitPacket(packet,singleton.getTimestamp(),32,32);//store time stamp    
        storeBitPacket(packet,fs.statSync(image).size,64,32);

        payload = fs.readFileSync(image);
        return Buffer.concat([packet,payload]);
  }, 
  editImagePacketResponse: function (data){
    let existingPacket = data.slice(4)
    let modification = Buffer.alloc(4)

    storeBitPacket(modification, parseBitPacket(data, 0, 4), 0, 4)
    storeBitPacket(modification, 1, 4, 8)//setting response type to 1, found to client
    storeBitPacket(modification, parseBitPacket(data, 12, 20), 12, 20)
    return Buffer.concat([modification, existingPacket])
  }
};

function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >>> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}

// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}

function getImageType(end) {//returns image type depending on packet
  let IT;
  switch(end.toLowerCase()){ 
    case "bmp": IT =1; break;
    case "jpeg": IT =2; break;
    case "gif": IT =3; break;
    case "png": IT =4; break;
    case "tiff": IT =5; break;  
    case "raw": IT =15; break;       
  }
  return IT;
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