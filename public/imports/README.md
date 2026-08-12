# STRATA import templates

Sample files for bulk loading **clients**, **facilities**, **buildings**, **floors / functional areas**, and **inventory**.

| File | What it is |
|---|---|
| `STRATA-import-template.xlsx` | Workbook with Instructions, AllowedValues, and one sheet per entity (recommended) |
| `clients.csv` | Two sample clients |
| `facilities.csv` | Three facilities |
| `buildings.csv` | Six buildings |
| `floors.csv` | Floor records |
| `functional-areas.csv` | Rooms / FAs |
| `inventory.csv` | 24 inventory rows |

## Join keys

```
client_number  →  facility_id  →  building_number  →  inventory_code
                                      ↳ floor_name / fa_code
```

Import in that order. `inventory_code` must be unique. Quantity and condition changes append history — they never overwrite the past.

## Sample portfolio (will not collide with the Northline demo seed)

- **HLM-220** Harborline Manufacturing Co. — River Rouge plant + Jefferson warehouse
- **CCHA-15** Cass Corridor Housing Authority — Brewster Courts A & B

Password for the live demo app is unchanged (`Strata2026!`). These codes are *new* so you can practice an import on top of MetroHealth / Lakeside.

## Controlled values

See the **AllowedValues** sheet. ACM classification, condition, units, photo policy, and response actions match the STRATA editors.
