# Source: BBMP 243 wards

- **File:** `source/BBMP.geojson`
- **From:** DataMeet, Municipal Spatial Data, `Bangalore/BBMP.geojson`
  (https://github.com/datameet/Municipal_Spatial_Data/blob/master/Bangalore/BBMP.geojson),
  commit `9b4d1c2` (2023-11-16)
- **Retrieved:** 2026-09-27
- **What it is:** 243 wards as per the 2022 delimitation. DataMeet notes it was scraped from KSRSAC's KGIS portal (https://kgis.ksrsac.in/bengalurugis/), which is the official source.
- **Licence:** Creative Commons Attribution-ShareAlike 2.5 India
  (CC BY-SA 2.5 IN, http://creativecommons.org/licenses/by-sa/2.5/in/), as
  stated in DataMeet's `Bangalore/Readme.md`. This overrides the
  repository-wide CC BY 4.0 default. Attribution: *BBMP ward maps by the
  DataMeet India community (http://datameet.org/), CC BY-SA 2.5 IN.*

## Why a third-party file

Primary sources come first (docs/ROADMAP.md, data sourcing policy). This file
is a stand-in because the official portals (KGIS, BBMP) couldn't be reached
from the build environment on 2026-09-27. The maintainer approved using
DataMeet in the meantime, while official files are pursued through network
access and RTI.

**Swap plan:** once an official file is obtained, replace `source/`, update
`mapping.json` and this note, and re-run `npm run build-wards -- bbmp243`.
Ward codes (`bbmp243:<ward_no>`) don't change, so project records stay valid.
