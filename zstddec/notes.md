## wasm zstd decoder for tar1090

Adaptation of the javascript shim from: https://github.com/donmccurdy/zstddec

See html/libs/zstddec-tar1090-VERSION.js for the js shim with compiled wasm, ready for usage.
The base64 converted wasm is placed into the C variable, you can't miss the long line :)
If you're interested in compiling the wasm yourself, see the instructions further down.

### API:
```
import { ZSTDDecoder } from 'zstddec';

const decoder = new ZSTDDecoder();

await decoder.init();

// requires and returns Uint8Array
const decompressedArray = decoder.decode( compressedArray, uncompressedSize );
```

### Example:

Include the js file in your html:
```html
    <script src="zstddec-tar1090-0.0.4.js"></script>
```

In your js, use code similar to this to use zstddec-tar1090:
```js
let zstdDecode = null;

function webAssemblyFail(e) {
    zstdDecode = null;
    console.log(e);
    console.error("Error loading zstddec, probable cause: webassembly not present or not working");
    zstd = false;
    // possibly display an error if your page requires zstddec
}

zstddec.decoder = new zstddec.ZSTDDecoder();
zstddec.promise = zstddec.decoder.init().catch(e => webAssemblyFail(e));
zstdDecode = zstddec.decoder.decode;

function arraybufferRequest() {
    let xhrOverride = new XMLHttpRequest();
    xhrOverride.responseType = 'arraybuffer';
    return xhrOverride;
}

function startPage() {
    let req = jQuery.ajax({
        url: "http://127.0.0.1/test.zstd", method: 'GET',
        xhr: arraybufferRequest,
        timeout: 15000,
    });

    req.done(function(data) {
        let arr = new Uint8Array(data);
        lastRequestSize = arr.byteLength;
        let res;
        try {
            res = zstdDecode( arr, 0 );
        } catch (e) {
            console.error(e);
            return;
        }
        // process the decompressed data, for example, make it a string and parse as json:
        let dstring = String.fromCharCode.apply(null, dresult);
        let djson = JSON.parse(dstring);
    });
}

zstddec.promise.then(function() {
        startPage();
        });
```

### Compiling the wasm from source:

#### obtaining C source:
```
wget https://github.com/facebook/zstd/releases/download/v1.5.0/zstd-1.5.0.tar.gz
tar xf zstd-1.5.0.tar.gz
cd zstd-1.5.0/build/single_file_libs
./combine.sh -r ../../lib -o zstddeclib.c zstddeclib-in.c
cp zstddeclib.c ../../..
cd ../../..
```

#### apply patch

```
patch -u zstddeclib.c -i changes.diff
```
* findDecompressedSize interface changed from unsigned long long to U32 for wasm / browser compatibility (uncompressed filesize limit 4294967294 bytes)
* the diff to the file created by combine.sh is also provided: changes.diff
* the modified file zstddeclib.c required for compilation is included in this directory

#### compilation:
```
docker pull emscripten/emsdk:3.1.15
docker run --rm -v $(pwd):/src -u $(id -u):$(id -g) emscripten/emsdk:3.1.15 emcc zstddeclib.c --no-entry -O3 -s EXPORTED_FUNCTIONS="['_ZSTD_decompress', '_ZSTD_findDecompressedSize', '_ZSTD_isError', '_malloc', '_free']" -s ALLOW_MEMORY_GROWTH=1 -s TOTAL_STACK=64kb -s TOTAL_MEMORY=2Mb -o zstddec.wasm
```
TOTAL_MEMORY is the initial heap size which grows as necessary.

### convert to base64 for direct inclusion in js file:
```
base64 -w0 zstddec.wasm > zstddec.wasm.base64
```
