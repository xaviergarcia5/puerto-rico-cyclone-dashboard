# puerto-rico-cyclone-dashboard

Historical dashboard of tropical cyclones Irma and Maria (2017), Fiona (2022), and Ernesto (2024) in Puerto Rico. Integrates NOAA GOES-16 imagery, NOAA NWS/NCEP Stage IV precipitation estimates, USGS rain-gauge observations, and NOAA National Hurricane Center tracks and intensity records.

## Open the dashboard

Live application: https://geocapacity-ciclones.pages.dev/

The default language is **Spanish**. An English language selector is provided
in the application. This publication preserves the existing application,
its observations and its 672 WebP frames without changing their resolution.

For a local copy, keep the complete directory structure and open index.html.
Alternatively, with Python installed, run `python -m http.server 8000`
from the repository folder and open http://localhost:8000/.

## Contents and scope

- HTML, CSS and JavaScript application source in the repository root.
- `frames/`: 168 imagery frames for each of the four events.
- Processed precipitation, station, track and geographical assets required
  by the existing application.
- `METODOLOGIA_Y_FUENTES.txt`: methods, source links and interpretive limitations.
- `LICENSE_D3.txt`: the retained license of the bundled D3.js library.
- `docs/originales/`: historical preparation notes. Paths and deployment
  statements in these older notes describe their original preparation context.

This package preserves the working application and its processed display
assets. It is not a complete archive of the original GOES NetCDF and Stage IV
GRIB downloads or of all upstream processing environments. The application
and the original observation products are distinct research objects.

## Interpretation

The scenes were selected approximately every 30 minutes; actual acquisition
timestamps are retained. Positions between official NHC records are
interpolated for display and do not represent additional observations.
The rainfall map displays accumulated gridded estimates. Station symbols
display separate observed rainfall totals, with missing readings indicated.
The panel provides historical and educational context, not operational warnings.

## Author and development

Xavier A. García López
Department of Environmental Sciences, University of Puerto Rico, Río Piedras
Contact: xavier.garcia5@upr.edu

HTML, CSS and JavaScript support the application, with D3.js for map
interaction and Python used in the upstream processing. Codex, an OpenAI
coding assistant, supported script development, review and integration.

## License and commercial use

Original application code is provided under **PolyForm Noncommercial 1.0.0**.
Read `LICENSE` and `NOTICE`. Permitted noncommercial use and modification
do not require a payment. The license also contains express permissions for
the institutions and organizations named in its text.

Commercial uses outside those permissions require prior written authorization
under a separate paid license. See `COMMERCIAL_USE.md`.
This is source-available software under noncommercial terms; it is not
described as OSI-defined open-source software.

The data and third-party code retain their own conditions. Read
`THIRD_PARTY_NOTICES.md`; the application's license does not relicense them.

## Citation and archival release

Citation metadata are supplied in `CITATION.cff`. A Zenodo DOI has not yet
been assigned. The DOI and release version will be added after the author
completes publication. A specific release DOI will identify the version used
in the article; the general DOI will identify the evolving software record.

`MANIFEST.sha256` records the packaged file checksums. Its entries exclude
the manifest itself and will need updating when the archived files change.
