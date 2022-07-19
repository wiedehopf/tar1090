## wasm zstd decoder for tar1090

obtaining C source:
```
wget https://github.com/facebook/zstd/releases/download/v1.5.0/zstd-1.5.0.tar.gz
tar xf zstd-1.5.0.tar.gz
cd zstd-1.5.0/build/single_file_libs
./combine.sh -r ../../lib -o zstddeclib.c zstddeclib-in.c
```

* findDecompressedSize interface changed from unsigned long long to U32 for wasm / browser compatibility (uncompressed filesize limit 4294967294 bytes)
* the modified file zstddeclib.c required for compilation is included in this directory
* the diff to the file created by combine.sh is also provided: changes.diff

compilation instructions used:
```
docker pull emscripten/emsdk:3.1.15
docker run --rm -v $(pwd):/src -u $(id -u):$(id -g) emscripten/emsdk:3.1.15 emcc zstddeclib.c --no-entry -O3 -s EXPORTED_FUNCTIONS="['_ZSTD_decompress', '_ZSTD_findDecompressedSize', '_ZSTD_isError', '_ZSTD_getErrorName', '_malloc', '_free']" -s ALLOW_MEMORY_GROWTH=1 -o zstddec.wasm
```

convert to base64 for direct inclusion in js file:
```
base64 -w0 zstddec.wasm > zstddec.wasm.base64
```

