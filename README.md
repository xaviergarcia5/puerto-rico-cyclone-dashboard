# puerto-rico-cyclone-dashboard

Historical dashboard of tropical cyclones Irma and Maria (2017), Fiona (2022), and Ernesto (2024) in Puerto Rico. Integrates NOAA GOES-16 imagery, NOAA NWS/NCEP Stage IV precipitation estimates, USGS rain-gauge observations, and NOAA National Hurricane Center tracks and intensity records.

## Open the dashboard

[Open the dashboard on GitHub Pages](https://xaviergarcia5.github.io/puerto-rico-cyclone-dashboard/)

The dashboard was originally developed in **Spanish**, which remains the default.
Use the language selector in the upper-right corner to switch to **English**.
The two languages share the same observations and 672 WebP frames.

For a local copy, keep the complete directory structure and open index.html.
Alternatively, with Python installed, run `python -m http.server 8000`
from the repository folder and open http://localhost:8000/.

## Contents and scope

- HTML, CSS and JavaScript application source in the repository root.
- `frames/`: 168 imagery frames for each of the four events.
- Processed precipitation, station, track and geographical assets required
  by the existing application.
- `METHODS_AND_SOURCES.txt`: methods, source links and interpretive limitations.
- `LICENSE_D3.txt`: the retained license of the bundled D3.js library.
- [Processing scripts and reproduction instructions](processing/README.md) in English.
- `docs/`: English summaries of the project and the bilingual interface.

The repository includes the released application, its display assets and the
scripts for GOES-16, HURDAT2, Stage IV and USGS processing. The GOES NetCDF
and Stage IV GRIB archives are available through the providers listed in the
processing guide. The archived USGS inputs and HURDAT2 excerpts are included.

## Interpretation

The scenes were selected approximately every 30 minutes; actual acquisition
timestamps are retained. Positions between official NHC records are
interpolated for display and do not represent additional observations.
The rainfall map displays accumulated gridded estimates. Station symbols
display separate observed rainfall totals, with missing readings indicated.
The panel provides historical and educational context, not operational warnings.

## Author and development

Xavier A. García-López
Contact: xavieralfredo.garcia01@gmail.com

HTML, CSS and JavaScript support the application, with D3.js for map
interaction and Python used in the upstream processing. Codex, an OpenAI
coding assistant, supported script development, review and integration.

## License and commercial use

Original application and processing code is provided under **PolyForm Noncommercial 1.0.0**.
Read `LICENSE` and `NOTICE`. Permitted noncommercial use and modification
do not require a payment. The license also permits use by the categories of organizations
it specifies.

Commercial uses outside those permissions require prior written authorization
under a separate paid license. See `COMMERCIAL_USE.md`.
This is source-available software under noncommercial terms; it is not
described as OSI-defined open-source software.

The data and third-party code retain their own conditions. Read
`THIRD_PARTY_NOTICES.md`; the application's license does not relicense them.

## Citation and archival release

[![Zenodo project DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24069499.svg)](https://doi.org/10.5281/zenodo.24069499)

The [project DOI](https://doi.org/10.5281/zenodo.24069499) identifies the dashboard across
versions. Cite [version 1.0.0](https://doi.org/10.5281/zenodo.24069500) when referring to that
specific archive. Citation metadata are supplied in `CITATION.cff`.

`MANIFEST.sha256` records the packaged file checksums. Its entries exclude
the manifest itself and will need updating when the archived files change.
