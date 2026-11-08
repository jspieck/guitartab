Place the SoundFont files here before building for production (they are not in git; the
server's /audio/ folder is uploaded by hand and survives deploys):

    GeneralUser-GS.<hash>.sf3   the streamed bank, ~8 MB (name in manifest.json)
    GeneralUser-GS.sf2          the original, 32 MB: fallback where no Vorbis decoder works
    manifest.json               tracked in git; the build reads it

The app fetches the SF3's preset data and then only the samples a song uses (HTTP range
requests), the rest when the browser is idle (Big win 32). Make the SF3 from the SF2 with
ffmpeg (libvorbis):

    node scripts/convert-soundfont.mjs public/audio/GeneralUser-GS.sf2 [--ffmpeg <path>] [--quality 5]

It writes GeneralUser-GS.<hash>.sf3 and manifest.json (name, size, SHA-256, where the parts
sit). Upload the new .sf3 to <document root>/audio/ before deploying a build with the new
manifest, and check the server with:

    node scripts/check-soundfont.mjs https://<site>/

Without manifest.json (or with SOUNDFONT_MANIFEST=off at build time) the app loads
GeneralUser-GS.sf2 whole, as before. ?soundfont=sf2 loads the SF2 for an A/B comparison.

GeneralUser GS (v2.0.3) by S. Christian Collins: https://github.com/mrbumpy409/GeneralUser-GS
(the file `GeneralUser-GS.sf2` in the repository root). Its licence allows use and
redistribution in software, also of modified copies (the SF3 is one); ship
documentation/LICENSE.txt from that repository with it (kept here as
GeneralUser-GS-LICENSE.txt). The author asks not to hot-link his download files: host your
own copy.

Optional, to compare by ear: MuseScore_General.sf3 (v0.2.0, MIT, based on FluidR3;
https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/). Its licence asks for the
acknowledgements to ship with it: MuseScore_General-LICENSE.md. Open the app with
?soundfont=musescore to use it (a banner names the bank that loaded).
