const canvasWidth = 320;
const canvasHeight = 160;
let webcodecSupported = true;
let keepGoing = true;
let pendingOutputFrame = 0;
let ts = 0;

if (!("VideoEncoder" in window)) {
	document.body.innerHTML = "<h1>WebCodecs API is not supported.</h1>";
	webcodecSupported = false;
}

function srcCanvas() {
    const canvas = document.getElementById('srcCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    return [canvas, ctx];
}

function dstCanvas() {
    const canvas = document.getElementById('dstCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    return [canvas, ctx];   
}

function handleChunk(chunk) {
    //console.log("enter encoder::handleFrame");
    pendingOutputFrame --;

    let encodedData = new Uint8Array(chunk.data);  // actual bytes of encoded data
    let encodedTimestamp = chunk.timestamp;        // media time in microseconds
    let is_key = chunk.type == 'key';       // can also be 'delta'
    
    // We have the data chunk, now decode to frame
    decoder.decode(chunk);
}

async function handleFrame(frame) {
    //console.log("enter decoder::handleFrame");
    let bitmap = await frame.createImageBitmap();
    dst_ctx.drawImage(bitmap, 0, 0);
}

function getVideoEncoder() {
    const init = {
        output: handleChunk,
        error: (e) => {
            console.log(e.message);
        }
    };

    let config = {
        codec: 'vp09.00.10.08',
        width: canvasWidth,
        height: canvasHeight,
        bitrate: 8_000_000, // 8 Mbps
        framerate: 30,
    };

    let encoder = new VideoEncoder(init);
    encoder.configure(config);
    return encoder;
}

function getVideoDecoder() {
    const init = {
        output: handleFrame,
        error: (e) => {
            console.log(e.message);
        }
    };

    const config = {
        codec: 'vp09.00.10.08',
        codedWidth: canvasWidth,
        codedHeight: canvasHeight
    };

    let decoder = new VideoDecoder(init);
    decoder.configure(config);
    return decoder;
}

async function play() {

    computeFrame(video, src_ctx);
    if (video.paused || video.ended) return;
    reqAnimation(play);

    ts += 1;
    let bitmap = await createImageBitmap(src_canvas);
    let frame_from_bitmap = new VideoFrame(bitmap, { timestamp: ts }); // format: YUV420
    let fps = 30;
    let frame_counter = 0;

    if (!keepGoing) {
        console.log("Not playing, no need to encode");
        return;
    }
    if (pendingOutputFrame > 30) {
        console.log("Encoder overflow, drop frame");
        return;
    }
    
    pendingOutputFrame++;
    const insertKeyframe = (ts % 150) == 0;
    encoder.encode(frame_from_bitmap, { keyFrame: insertKeyframe });
}

function computeFrame(video, ctx) {
    const width = canvasWidth;
    const height = canvasHeight;
    ctx.drawImage(video, 0, 0, width, height);
}
//----------------------------------------------------

if (!webcodecSupported) {
	throw new Error("webcodecs are not supproted!");
}

window.reqAnimation = window.mozRequestAnimationFrame
|| window.requestAnimationFrame
|| window.webkitRequestAnimationFrame
|| window.msRequestAnimationFrame;

const [src_canvas, src_ctx] = srcCanvas();
const [dst_canvas, dst_ctx] = dstCanvas();
let video = document.getElementById('sourceVideo');
video.addEventListener('play', (e) => {
	play();
});

const playBtn = document.getElementById('play');
playBtn.addEventListener('click', event => {
	if (video.paused == false) {
    	video.pause();
    	keepGoing = false;
    	playBtn.innerHTML = "Play";
	} else {
    	video.play();
    	keepGoing = true;
    	playBtn.innerHTML = "Pause";
	}
})

const encoder = getVideoEncoder();
const decoder = getVideoDecoder();