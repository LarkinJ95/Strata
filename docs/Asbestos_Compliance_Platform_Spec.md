# Build a Production-Ready Building Asbestos Compliance Management Platform

Build a modern, production-ready, multi-tenant web application for managing asbestos-containing materials across buildings, facilities, campuses, and client portfolios.

The platform should be designed specifically for:

* Environmental professionals
* Industrial hygienists
* Asbestos building inspectors
* Management planners
* Facility owners
* Facility managers
* Environmental compliance departments
* Consultants
* Abatement contractors
* Client representatives

This must be a true asbestos compliance and building-management platform, not simply a spreadsheet replacement or generic project-management application.

The system should manage the entire lifecycle of asbestos information:
Client → Facility → Building → Material Discovery → Inspection → Sample → Laboratory Result → Inventory → Repair / Response Action → Reinspection → Abatement / Removal → Historical Record

Every material should maintain a permanent, traceable record of:

* What the material is
* Where it is located
* What it looks like
* How much exists
* What samples support its classification
* Laboratory results
* Historical quantities
* Inspection history
* Condition history
* Labeling history
* Repairs
* Repair photographs
* Removal history
* Documents
* Floor-plan location
* Users who modified the record
* Current actions required

Historical information must never be destroyed when materials are repaired, resampled, reclassified, partially removed, completely removed, or quantities change.

## 1. Core Product Philosophy

The defining feature of the application should be traceability.

At any moment a user should be able to answer:

* What asbestos-containing materials are in this building?
* Where are they?
* How much remains?
* What samples support each determination?
* What did the material look like when originally documented?
* Where exactly was the sample collected?
* When was the material last inspected?
* What condition was it in?
* Has that condition changed?
* Has it been repaired?
* What did it look like before and after repair?
* Has any quantity been removed?
* What documentation supports the record?
* What needs attention next?
* Who made each change and when?

Every major feature should support this goal.

## 2. Multi-Tenant Architecture

Support multiple organizations, clients, facilities, and buildings.

Hierarchy:
Organization → Client → Facility / Campus → Building → Floor / Area → Room / Location → Material / Homogeneous Area

An organization may manage many clients.
A client may have many facilities.
A facility may have many buildings.
A building may contain many:

* Inventory items
* Homogeneous areas
* Samples
* Inspections
* Repairs
* Floor plans
* Documents
* Photos
* Removal records

Strictly isolate organization and client data.
A client must never be able to access another client's records through manipulated URLs, API requests, search results, file URLs, or record IDs.

## 3. Users, Roles, and Permissions

Create configurable role-based access control.

Default roles:

**Organization Administrator** — Full system access.

**Environmental Manager** — Manage:

* Buildings
* Inventories
* Inspections
* Samples
* Laboratory results
* Repairs
* Reports
* Documents
* Users
* Management plans

**Inspector** — Perform:

* Surveys
* Inspections
* Sampling
* Photo documentation
* Field observations
* Repair recommendations
* Inspection submission

**Technician** — Limited field and sampling capabilities.

**Client Administrator** — Access authorized client facilities and optionally manage internal client users.

**Client Viewer** — Read-only client portal.

**Contractor** — Restricted access to specifically assigned:

* Work orders
* Buildings
* Inventory materials
* Repair projects
* Abatement projects
* Documents

Permissions should be granular.

Examples:

* View inventory
* Edit inventory
* Create inventory
* Add samples
* Enter sample results
* Approve laboratory results
* Reconcile samples
* Perform inspections
* Approve inspections
* Add photos
* Download photos
* Create repairs
* Close repairs
* Verify repairs
* Record removals
* Upload documents
* Download documents
* Generate reports
* View audit history
* Manage users
* Manage client access
* View cost information

Do not rely only on broad hard-coded roles.

## 4. Client Management

Each client should contain:

* Client name
* Client number
* Primary contact
* Secondary contacts
* Address
* Phone
* Email
* Client logo
* Notes
* Contract information
* Inspection requirements
* Reporting requirements
* Document requirements
* Notification preferences
* Photography restrictions
* Custom fields

Allow client-specific configurations without altering the platform globally.

## 5. Facility / Campus Management

Clients may contain multiple sites or campuses.

Each facility should contain:

* Facility name
* Facility ID
* Address
* GPS coordinates
* Primary contact
* Environmental contact
* Emergency contact
* Notes
* Maps
* Documents
* Buildings

Provide a facility dashboard containing all buildings and their current asbestos-management status.

## 6. Building Profiles

Each building should contain:

* Building name
* Building number
* Client
* Facility
* Address
* GPS coordinates
* Year constructed
* Square footage
* Floors
* Building use
* Occupancy status
* Active/inactive status
* Renovation history
* Demolition status
* Survey status
* Last inspection
* Next inspection
* Responsible environmental manager
* Management plan status
* Photograph permissions
* Building contacts
* Notes

Allow unlimited:

* Floor plans
* Survey reports
* Inspection reports
* Laboratory reports
* Chain-of-custody forms
* Photos
* Repair documentation
* Abatement documentation
* Historical documentation

## 7. Building Dashboard

The building dashboard should immediately answer:
What needs attention in this building?

Show:

* Active asbestos inventory records
* Confirmed ACM
* Assumed ACM
* PACM
* Non-ACM
* Unknown materials
* Total estimated quantities
* Materials requiring repair
* High-priority damaged material
* Open repairs
* Overdue repairs
* Repairs awaiting verification
* Samples pending laboratory results
* Samples awaiting inventory reconciliation
* Upcoming inspections
* Overdue inspections
* Last inspection
* Recently added samples
* Recently discovered materials
* Recent removals
* Recent documents
* Recent activity

Provide visual summaries by:

* Material
* Condition
* Floor
* Friability
* Quantity
* Response action
* Inspection status

## 8. Building Asbestos Inventory

Create a structured asbestos inventory.

Each inventory record should contain:

**Identification**

* Inventory ID
* Client
* Facility
* Building
* Floor
* Room
* Area
* Specific location
* Material category
* Material description
* Homogeneous area ID
* Internal material code

**ACM Classification**

Support:

* Confirmed ACM
* Non-ACM
* Assumed ACM
* PACM
* Unknown / unsampled
* Previously removed

**Asbestos Information**

Track:

* Asbestos detected?
* Fiber type
* Percentage
* Multiple fiber types
* Friable / non-friable
* TSI
* Surfacing material
* Miscellaneous material
* Category I / Category II where applicable
* Analytical method supporting determination

Regulatory classifications should be configurable rather than permanently hard-coded.

## 9. Inventory Quantities

Support quantities using:

* Linear feet
* Square feet
* Cubic feet
* Each
* Units
* Other configurable units

Track:

* Original estimated quantity
* Current estimated quantity
* Quantity repaired
* Quantity removed
* Quantity remaining
* Quantity uncertainty
* Quantity source
* Quantity notes

Every quantity change must create a history entry.

Example:
Original quantity 1,250 SF → 2026 removal -400 SF → Remaining 850 SF

Never overwrite historical quantities.

## 10. Inventory Condition

Provide configurable conditions such as:

* Good
* Fair
* Damaged
* Significantly damaged
* Needs Repair
* Removed
* Inaccessible
* Unable to Inspect

Track condition history.

Each change should capture:

* Previous condition
* New condition
* Date
* Inspection
* Inspector
* Notes
* Photos

## 11. Accessibility and Disturbance

Track:

**Accessibility**

* Accessible
* Restricted
* Inaccessible
* Above ceiling
* Mechanical space
* Confined area
* Exterior
* Other

**Potential for Disturbance**

* Low
* Moderate
* High

## 12. Labeling

Track asbestos labeling separately from material condition.

Fields:

* Label present?
* Label condition
* Label replaced
* Label missing
* Unable to replace
* Label date
* Label photo
* Notes

Maintain labeling history.

## 13. Response Actions

Allow recommended actions such as:

* No action
* Continue surveillance
* Repair
* Encapsulate
* Enclose
* Remove
* Restrict access
* Further sampling
* Engineering evaluation
* Other

Response actions may generate:

* Tasks
* Repairs
* Notifications
* Work orders

## 14. Inventory Item Photos

Photos must be treated as structured compliance records, not generic attachments.

Every inventory item should contain its own gallery.

Support:

* Primary inventory photo
* Material photo
* Location/context photo
* Close-up photo
* Condition photo
* Damage photo
* Label photo
* Historical photo
* Repair photo
* Post-repair photo
* Removal photo

Each photo should track:

* Photo ID
* Related inventory item
* Building
* Floor
* Room
* Date captured
* Time captured
* Captured by
* Uploaded by
* Photo category
* Caption
* Notes
* Inspection
* GPS coordinates where available
* Original filename
* Upload date

Allow one photo to be designated **Primary Inventory Photo**. Display this prominently when viewing the material.

## 15. Homogeneous Areas

Create homogeneous areas that may contain:

* Multiple rooms
* Multiple locations
* Multiple inventory records
* Multiple samples

Each homogeneous area should contain:

* Homogeneous area ID
* Building
* Material
* Material description
* Floors
* Rooms / locations
* Samples
* Sample results
* Determination
* Quantity
* Quantity unit
* Condition
* Notes
* Photos

Clearly identify which samples support the final determination.

## 16. Sample Management

Sampling must be a first-class module.

A sample should not automatically become an inventory record.

Workflow:
Sample Collected → Laboratory Analysis → Results Received → Results Reviewed → Sample Reconciled → Inventory Created or Updated

Each sample should contain:

* Sample number
* Client sample number
* Building
* Floor
* Room
* Location
* Homogeneous area
* Material
* Material description
* Collection date
* Collection time
* Inspector
* Sampling method
* Notes
* Chain-of-custody record
* Laboratory
* Laboratory sample number
* Analysis method
* Date received
* Date analyzed
* Date results received
* Status

## 17. Sample Photos

Every sample should support multiple photographs.

Photo types:

* Material overview
* Sample location
* Close-up
* Sample after collection
* Sample bag
* Sample label
* Surrounding area
* Other

Ideal workflow:

1. Inspector creates sample.
2. Inspector photographs material.
3. Inspector photographs exact sample location.
4. Inspector optionally photographs sample bag.
5. Photos automatically remain associated with sample.

Display sample photos directly beside:

* Sample number
* Location
* Material description
* Laboratory result

When a sample supports an inventory item, allow its photos to also appear as supporting photos within the inventory item without duplicating the source image file.

## 18. Sample Layers

Support layered samples.

Example:
Sample 26-001 → Layer 1: Floor Tile, Layer 2: Mastic

Each layer may contain:

* Different asbestos percentage
* Different asbestos fiber
* Different classification
* Different inventory record

A single physical sample may therefore support multiple inventory materials.

## 19. Laboratory Results

Support configurable analysis methods.

Examples:

* PLM
* PLM Point Count
* TEM
* Gravimetric Reduction
* Chatfield
* Other

Results should include:

* Asbestos detected
* Asbestos not detected
* Percentage
* Fiber types
* Multiple components
* Layer-specific result
* Detection limit
* Analyst comments
* Laboratory comments
* Laboratory report
* Certificate upload

## 20. Laboratory Result Import

Allow:

* Manual entry
* CSV import
* XLSX import
* Future API integration

Create a mapping workflow.

Automatically flag:

* Unknown sample numbers
* Duplicate samples
* Missing results
* Invalid percentages
* Missing methods
* Existing conflicting results

Never silently overwrite existing results.

## 21. Sample-to-Inventory Reconciliation

Create a dedicated workflow called **Reconcile Sample Results**.

Show all completed laboratory results that have not been reconciled with building inventory.

Allow users to:

* **Add as New Inventory Record** — Create new inventory material.
* **Link to Existing Inventory** — Associate sample with existing material.
* **Update Existing Inventory** — Apply new supporting results.
* **Supporting / Duplicate Sample** — Maintain sample without creating duplicate inventory.
* **No Inventory Entry Required** — Require explanation.

When creating inventory require:

* Building
* Floor
* Location
* Material
* Classification
* Quantity
* Unit
* Condition
* Sample linkage

Maintain permanent traceability between samples and inventory.

## 22. New Material Discovery

During an inspection allow inspectors to create **New Suspect Material**.

Fields:

* Building
* Floor
* Room
* Location
* Material
* Estimated quantity
* Unit
* Condition
* Friability
* Notes
* Photos

Options:

* Assume ACM
* Collect sample now
* Schedule sampling
* Add provisional inventory record

Clearly identify provisional records.

Photos should follow the material through:
Discovery → Sample → Laboratory Result → Inventory

## 23. Inspections

Create inspection types including:

* Initial survey
* Periodic surveillance
* Annual inspection
* Reinspection
* Repair inspection
* Post-repair verification
* Pre-renovation survey
* Pre-demolition survey
* Limited survey
* Supplemental survey
* Custom inspection

Allow administrators to create inspection templates.

## 24. Inspection Scheduling

Allow inspection recurrence such as:

* Annual
* Semiannual
* Three-year
* Custom interval
* One-time

Show:

* Upcoming
* Due within 30 days
* Due within 60 days
* Overdue
* Completed

Provide notifications.

## 25. Printable Inspection Forms

Allow users to generate professional inspection forms before going into the field.

Do not print raw application pages. Generate a proper PDF inspection packet.

Include:

* Client
* Facility
* Building
* Building number
* Inspection type
* Inspection date
* Inspector
* Previous inspection date

For each inventory item include:

* Inventory ID
* Material
* Floor
* Room
* Location
* Quantity
* Unit
* Previous condition
* Current-condition field
* Previous label status
* Label-status field
* Notes

Inspection options should include:

**Condition** — Good, Needs Repair, Removed, Inaccessible

**Labeling** — Good, Replaced, Missing, Could Not Replace

Provide additional sections for:

* New materials
* Samples collected
* Repair recommendations
* Inspector notes
* Signature
* Date

Allow printing:

* Entire building
* Specific floors
* Specific rooms
* ACM only
* Materials requiring inspection
* Materials with open repairs

## 26. Mobile Inspection Mode

Create a field-focused workflow optimized for phones and tablets.

Workflow:

1. Select facility.
2. Select building.
3. Start inspection.
4. Work through inventory sequentially.
5. Confirm material/location.
6. Record condition.
7. Record label status.
8. Add notes.
9. Capture photos.
10. Record material removed if applicable.
11. Add newly discovered material.
12. Collect samples.
13. Create repair.
14. Continue.
15. Review.
16. Sign.
17. Submit.

Display completion percentage. Support autosave. Allow draft inspections to be resumed.

If technically feasible, support offline inspection capability with later synchronization. **Offline sync must define conflict resolution behavior explicitly** — e.g., when two inspectors edit the same inventory item while offline, specify whether the system takes last-write-wins, flags a conflict for manual review, or merges field-by-field. Silent overwrite of a field record is not acceptable for a compliance system.

## 27. Inspection Photos

Inspectors should be able to capture photos directly within an inventory inspection.

Provide a prominent **Add Photo** action.

Categories:

* Material
* Condition
* Damage
* Label
* Location
* Repair Needed
* Other

Automatically associate photo with:

* Inventory item
* Inspection
* Building
* Inspector
* Date/time

Avoid making inspectors repeatedly select information the system already knows.

## 28. Photo-Required Rules

Allow administrators to configure when photographic documentation is required.

For example, photos may remain optional when:

* Material remains in good condition
* No change occurred

Photos may be required when:

* Material is marked damaged
* Condition worsens
* Repair is requested
* Repair is completed
* Material is marked removed
* New material is discovered
* Sample is collected

Photography requirements must automatically be disabled when a building prohibits photographs.

## 29. Building Photography Restrictions

Allow photography policies at:

* Client
* Facility
* Building

Possible settings:

* Photography Permitted
* Photography Prohibited
* Approval Required
* Limited Photography

If prohibited, inspectors should see a prominent message before inspection:
PHOTOGRAPHY NOT PERMITTED FOR THIS BUILDING

Do not make photo fields required in restricted buildings.

## 30. Repairs and Response Actions

Create a dedicated repair module.

Each repair should link directly to an inventory material.

Track:

* Repair ID
* Client
* Facility
* Building
* Inventory material
* Location
* Problem
* Condition
* Date identified
* Inspector
* Priority
* Recommended response
* Assigned contractor
* Assigned employee
* Work-order number
* PO number
* Estimated cost
* Scheduled date
* Completion date
* Completion notes
* Documents
* Photos
* Air-monitoring documentation
* Waste documentation
* Clearance documentation

Statuses:

* Open
* Assigned
* Scheduled
* In Progress
* Awaiting Verification
* Completed
* Closed
* Cancelled

## 31. Repair Photos

Organize repair photos into:

**Before** — Document damage, existing condition, location, existing labels, surrounding material.

**During** — Optional documentation of work area, containment, repair, encapsulation, enclosure, removal.

**After** — Document completed repair, final appearance, new label, finished material.

**Verification** — Inspector verification photographs.

Provide a visual workflow: Before → During → After → Verification

## 32. Repair Verification

Repairs should not automatically close when contractor work is marked complete.

Allow or require environmental verification.

Track:

* Verification date
* Inspector
* Repair satisfactory?
* Updated condition
* Updated quantity
* Label status
* Photos
* Notes
* Follow-up required

Maintain permanent repair history.

## 33. Material Removal / Abatement

Never delete inventory records when materials are removed.

Create removal events.

Track:

* Inventory item
* Quantity before
* Quantity removed
* Quantity remaining
* Unit
* Date
* Contractor
* Project number
* Work order
* Notification number
* Waste shipment record
* Disposal facility
* Clearance documentation
* Air monitoring
* Photos
* Notes

Allow:

* Partial removal
* Complete removal

Complete removal changes current status to **Removed** while preserving complete historical information.

## 34. Removal Photos

Support:

* Pre-removal condition
* Work area
* Removal activity
* Final condition
* Remaining material
* Labeling
* Clearance condition

Connect removal photographs to both:

* Removal event
* Historical inventory timeline

## 35. Photo History

Never replace historical photographs.

Inventory items should provide chronological visual history.

Example:
2025 Inspection (Condition: Good) → 2026 Inspection (Condition: Damaged) → Repair Before/After → Verification

Users should be able to visually understand how a material changed over time.

## 36. Photo Comparison

Provide comparison tools such as:

* Previous Inspection | Current Inspection
* Before Repair | After Repair

Allow users to compare photographs side-by-side.

## 37. Photo Annotation

Support optional markup.

Allow:

* Arrows
* Circles
* Boxes
* Text
* Highlights
* Sample-location indicators

Always preserve:

1. Original image
2. Annotated version

Never overwrite original photographs.

## 38. Building Photo Gallery

Each building should contain a centralized photo gallery.

Filter by:

* Inventory
* Material
* Sample
* Inspection
* Repair
* Damage
* Label
* Removal
* Floor
* Room
* Date

Selecting a photo should display:

* Image
* Date
* Caption
* Location
* Material
* Sample
* Inspection
* Repair
* User

Related records should be clickable.

## 39. Photo Metadata

Track:

* Photo ID
* Organization
* Client
* Facility
* Building
* Related record
* Original filename
* Storage key
* Capture date/time
* Upload date/time
* Photographer
* Uploader
* Category
* Caption
* Notes
* GPS coordinates
* File size
* MIME type
* Width
* Height

Preserve useful EXIF information where appropriate. Do not expose sensitive metadata to clients unless permitted.

## 40. Photo Storage Architecture

Store image files in object storage. Store relational metadata separately.

Recommended entities:

**photos** — id, organization_id, storage_key, original_filename, mime_type, size, width, height, captured_at, uploaded_at, uploaded_by, latitude, longitude

**photo_links** — id, photo_id, record_type, record_id, category, caption, primary_photo, visibility

**photo_annotations** — id, photo_id, annotation_data, created_by, created_at

One photo should be capable of supporting multiple records without duplicating the physical file.

## 41. Floor Plans and Drawings

Allow uploads of PDF, PNG, JPG, SVG.

Allow inventory items, samples, repairs, and discovered materials to be associated with floor-plan locations.

Future-ready architecture should support pins and polygons.

Pins may represent:

* Inventory
* Samples
* Repairs
* Damage
* Removed materials
* Restricted locations

Selecting a floor-plan item should display:

* Material
* Quantity
* Condition
* Latest photo
* Samples
* Open repairs
* Inspection status

## 42. QR Codes

Generate optional QR codes for:

* Buildings
* Floors
* Rooms
* Inventory items
* Mechanical rooms
* Other designated locations

Example: Scan mechanical-room QR code → Display all asbestos inventory for that room.

Allow printable QR labels. QR access must respect permissions.

## 43. Document Management

Create document libraries at:

* Client
* Facility
* Building
* Inventory item
* Sample
* Inspection
* Repair
* Removal
* Project

Document types:

* Survey reports
* Inspection forms
* Laboratory reports
* Chain-of-custody forms
* Management plans
* Floor plans
* Notifications
* Work orders
* Repair documentation
* Abatement records
* Waste manifests
* Clearance reports
* Air monitoring
* Contractor records
* Correspondence
* Photos
* Other

Track:

* Document name
* Type
* Uploaded by
* Upload date
* Document date
* Description
* Revision
* Related records
* Visibility

## 44. Chain-of-Custody Management

Support electronic and printable chain-of-custody forms.

Track:

* Project
* Building
* Inspector
* Samples
* Sample numbers
* Collection date/time
* Analysis requested
* Laboratory
* Relinquished by
* Received by
* Dates/times
* Shipping method
* Tracking number

Generate professional PDFs.

## 45. Inventory History

Every inventory item should have a complete timeline.

Example events:

* Material discovered
* Sample collected
* Lab result received
* Classified as ACM
* Inventory created
* Quantity updated
* Condition changed
* Photo added
* Label replaced
* Repair requested
* Repair performed
* Repair verified
* Material partially removed
* Material fully removed

Display:

* Date
* User
* Action
* Previous value
* New value
* Inspection
* Related document
* Related photo

## 46. Global Search

Search across the application by:

* Client
* Facility
* Building
* Building number
* Inventory ID
* Material
* Homogeneous area
* Sample number
* Laboratory sample number
* Room
* Location
* Fiber
* Repair
* Work order
* Project
* Inspector
* Contractor
* Document

Support partial matches.

## 47. Advanced Filters

Allow filtering inventory by:

* Client
* Facility
* Building
* Floor
* Room
* Material
* ACM status
* Asbestos percentage
* Fiber type
* Friability
* Condition
* Accessibility
* Quantity
* Label status
* Response action
* Repair status
* Last inspection
* Next inspection
* Sample status
* Removed status

Allow saved views.

## 48. Saved Views

Examples:

* Damaged ACM
* Repairs due this month
* Samples awaiting results
* Unreconciled laboratory results
* Missing labels
* Inspections due
* TSI
* Floor tile
* Removed materials
* Building-specific views

Allow team-shared views where appropriate.

## 49. Client Portal

Create a dedicated client-facing interface.

Clients should see only information explicitly authorized.

Possible client access:

* Facilities
* Buildings
* Current inventory
* Primary inventory photos
* Inspection status
* Inspection reports
* Sample results
* Sample photos
* Repairs
* Repair photos
* Management plans
* Building documents
* Historical records

Photo permissions should separately control:

* Inventory photos
* Sample photos
* Inspection photos
* Repair photos
* Photo downloads

Internal-only photos must never appear in the client portal.

## 50. Client Downloads

Allow authorized downloads of:

* Current inventory
* Historical inventory
* Inspection reports
* Building asbestos summaries
* Repair reports
* Sample reports
* Laboratory reports
* Management plans
* Building document packages

Formats: PDF, XLSX, CSV

## 51. Reporting

Generate professional branded reports.

Reports:

* Building Asbestos Inventory
* Inspection Report
* Repair Report
* Sample Summary
* Laboratory Results
* Open Action Items
* Removed Material Report
* Building History
* Client Portfolio
* Upcoming Inspections
* Overdue Inspections
* Management Plan

Reports should support:

* Organization logo
* Client logo
* Custom headers
* Custom footers
* Page numbers
* Signatures
* Revision numbers
* Report dates

## 52. Report Photography

Allow the report creator to choose:

* No photos
* Primary photos only
* Exception/damage photos
* Sample-location photos
* Before-and-after repair photos
* All relevant photos

Examples:

* **Inventory Report** — Primary material photograph.
* **Inspection Report** — Condition and damage photographs.
* **Sample Report** — Material and sample-location photographs.
* **Repair Report** — Before / after photographs.

Do not unnecessarily create enormous report files.

## 53. Organization Dashboard

Avoid cluttered dashboards full of meaningless metric cards.

The dashboard should answer: What needs attention today?

**Action Required**

* Overdue inspections
* Upcoming inspections
* High-priority damaged ACM
* Open repairs
* Overdue repairs
* Repairs awaiting verification
* Pending laboratory results
* Unreconciled results
* Missing required documents

**Portfolio**

* Clients
* Facilities
* Buildings
* Inventory items
* Open repairs
* Outstanding samples

**Recent Activity**

* Inspections
* Samples
* Repairs
* Removals
* Inventory changes
* Documents

## 54. Environmental Manager Compliance Queue

Create a dedicated **Compliance Queue**.

This should centralize:

* Overdue inspections
* Upcoming inspections
* Damaged materials
* New suspect materials
* Samples awaiting results
* Results awaiting reconciliation
* Open repairs
* Overdue repairs
* Repairs awaiting verification
* Missing documentation
* Incomplete inspection records
* Client requests

This should be one of the primary daily-use areas of the application.

## 55. Inspector Workspace

Create **My Inspections**.

Show:

* Today's inspections
* Upcoming inspections
* Draft inspections
* Submitted inspections
* Samples awaiting results
* Samples awaiting reconciliation
* Repairs requiring verification

Allow inspectors to quickly resume field work.

## 56. Notifications

Support in-app and email notifications.

Triggers:

* Upcoming inspection
* Overdue inspection
* Damaged ACM
* High-priority repair
* Repair overdue
* Sample submitted
* Laboratory result received
* Sample awaiting reconciliation
* Repair completed
* Repair awaiting verification
* Document uploaded

Design for future SMS support.

## 57. Tasks and Follow-Ups

Allow tasks associated with:

* Client
* Facility
* Building
* Inventory
* Sample
* Inspection
* Repair

Track: Task, Assigned user, Due date, Priority, Status, Notes

## 58. Management Plans

Allow generation and management of building asbestos management plans.

Include:

* Building information
* Responsible parties
* Current inventory
* Sample documentation
* Inspection history
* Response actions
* Repairs
* Removal history
* Training information
* Notifications
* Emergency procedures
* Contractor acknowledgements
* Documents

Allow professional PDF generation.

## 59. Contractor Acknowledgements

Allow facility managers to document disclosure of asbestos information to contractors.

Track:

* Contractor company
* Employee
* Building
* Date
* Inventory provided
* Documents provided
* Signature
* Expiration

## 60. Bulk Operations

Support large asbestos programs.

Allow:

* XLSX import
* CSV import
* Bulk inventory creation
* Bulk edit
* Bulk condition update
* Bulk labeling update
* Bulk quantity update
* Bulk inspection updates
* Bulk document association
* Bulk export

Always preview changes before committing.

## 61. Inventory Import Wizard

Workflow:

1. Upload file.
2. Select client.
3. Select facility.
4. Select building.
5. Map columns.
6. Preview data.
7. Validate.
8. Detect duplicates.
9. Correct errors.
10. Confirm import.
11. Generate import summary.

Provide downloadable templates.

## 62. Duplicate Detection

Detect likely duplicates using:

* Building
* Material
* Floor
* Room
* Location
* Homogeneous area
* Sample number

Never automatically merge compliance records. Require review.

## 63. Data Quality

Provide validation and quality checks.

Flag:

* Confirmed ACM without supporting sample/documentation
* Missing quantities
* Missing units
* Missing locations
* Duplicate samples
* Samples without results
* Results awaiting reconciliation
* Removed materials with remaining quantities
* Missing inspection dates
* Overdue inspections
* Open damaged-material repairs
* Repair marked completed without verification when verification is required
* Required photographs missing

## 64. Regulatory Configuration

Do not lock the software into a single jurisdiction.

Allow configurable profiles for:

* Inspection frequency
* Required fields
* Material classification
* Notification requirements
* Terminology
* Response actions
* Record retention
* Report templates
* State-specific requirements

The application should support varying client and jurisdictional requirements.

While the platform must stay jurisdiction-agnostic in its data model, the configurable profiles should be scoped against named baseline frameworks rather than left abstract, including at minimum: **AHERA** (40 CFR Part 763, schools), **NESHAP** (40 CFR Part 61 Subpart M, demolition/renovation notifications), **OSHA 1926.1101** (construction) and **1910.1001** (general industry) exposure/recordkeeping rules, and relevant **state-specific overlays** (e.g., California Cal/OSHA and Connected Business Enterprise rules, New York ICS-2/DOL Title 12, Illinois IDPH licensing) where those impose stricter inspection frequency, licensing, or notification requirements than the federal baseline.

## 65. Building Compliance Status

Do not claim that the software is making a legal compliance determination.

Use operational statuses such as:

* **Current** — No identified outstanding actions.
* **Attention Required** — Upcoming requirements or unresolved issues.
* **Action Required** — Overdue or significant unresolved issues.

Always show why the status was assigned.

Examples:

* Annual inspection overdue
* Three damaged materials
* Two unreconciled samples
* Repair overdue

## 66. Record Retention

Do not permanently delete compliance history during normal operation.

Use statuses such as:

* Active
* Archived
* Superseded
* Removed
* Cancelled

Controlled purge functionality should only be available to specifically authorized administrators when legally appropriate.

Retention periods and storage location are themselves regulatory-sensitive: some state programs require asbestos records be retained 30+ years (AHERA management plans must be retained for the life of the building), and some public-sector/government clients require on-shore or region-specific storage. The retention configuration (§64) should include a per-jurisdiction minimum retention period and, where relevant, a data-residency constraint honored by the storage architecture (§78).

## 67. Audit Trail

Audit every significant action.

Track:

* User
* Date/time
* Action
* Record
* Previous value
* New value
* Related inspection
* Related document

Audit:

* Inventory
* Quantities
* Conditions
* Samples
* Laboratory results
* Repairs
* Removals
* Inspections
* Documents
* Photos
* Client permissions
* User permissions

Audit history should be exportable.

## 68. Versioning

Support revisions for:

* Reports
* Inventories
* Management plans
* Inspection reports

Examples: Revision 0, Revision 1, Revision 2

Never destroy previous approved revisions.

## 69. Electronic Signatures

Support signatures for:

* Inspection completion
* Inspector certification
* Repair verification
* Contractor acknowledgement
* Client acknowledgement

Capture: Name, Signature, Role, Date, Time

## 70. Print-Friendly Records

Every important record should have a proper print layout. Especially:

* Inventory
* Inspection forms
* Inspection reports
* Sample lists
* Chain-of-custody forms
* Repairs
* Building summaries
* Management plans

Do not simply print browser UI.

## 71. Excel Export

Exports should contain clean structured data.

Avoid:

* Merged cells
* Decorative spreadsheet formatting that breaks filtering
* Unstable row identifiers

Include stable internal IDs to allow reconciliation during future imports.

## 72. Floor Plan and GIS Future Support

Architect locations so future GIS capabilities can be added.

Allow: Latitude, Longitude, Building footprint, Floor-plan coordinates, Material coordinates, Sample coordinates

Do not require full GIS implementation for the first release.

## 73. AI-Ready Architecture

Structure data to support future AI features.

Possible future capabilities:

* Natural-language asbestos inventory search
* Building-history summaries
* Draft inspection reports
* Detect missing data
* Flag inconsistent quantities
* Extract results from lab reports
* Summarize repairs
* Compare photographs over time

AI must never silently modify official compliance records. AI-generated changes must always require human review and approval.

## 74. Core Data Model

Use a normalized relational database.

Primary entities should include:

* organizations
* users
* roles
* permissions
* clients
* facilities
* buildings
* building_floors
* building_areas
* homogeneous_areas
* inventory_items
* inventory_quantity_history
* inventory_condition_history
* samples
* sample_layers
* sample_results
* laboratories
* chains_of_custody
* inspections
* inspection_items
* repairs
* repair_verifications
* removal_events
* photos
* photo_links
* photo_annotations
* documents
* floor_plans
* floor_plan_markers
* tasks
* notifications
* signatures
* audit_events
* **certifications** — see §87
* **regulatory_notifications** — see §88
* **exposure_monitoring_records** — see §89
* **incidents** — see §90

Do not store important structured compliance information solely inside JSON fields.

## 75. Relationship Rules

Design relationships carefully.

One homogeneous area may contain many samples.
One sample may contain multiple layers.
One laboratory result layer may create a separate inventory material.
One inventory item may have multiple supporting samples.
One inventory item may contain many: Inspections, Photos, Repairs, Documents, Quantity changes, Condition changes, Removal events.
One photograph may support multiple related records without duplicating the source image.

## 76. API Architecture

Build a clean API/service layer. Do not tightly couple database operations directly to UI components.

Plan for future integration with:

* Laboratories
* ERP systems
* Work-order systems
* Document management
* GIS
* Facility management platforms
* Mobile applications

## 77. Security

Implement:

* Secure authentication
* MFA-ready architecture
* Organization isolation
* Client isolation
* Granular permissions
* Signed document URLs
* Signed photo URLs
* Secure upload validation
* Rate limiting
* CSRF protections where applicable
* XSS protections
* SQL injection protection
* Session expiration
* Audit logging

Security must be enforced server-side. Never rely solely on hidden UI controls.

## 78. File Storage

Use object storage for: Documents, Photos, Reports, Floor plans.

Do not store large binary files directly inside relational database rows.

Preserve original filenames while using secure storage identifiers.

## 79. Performance

Design for:

* Hundreds of clients
* Thousands of facilities/buildings
* Hundreds of thousands of inventory records
* Large photo libraries
* Large document libraries
* Years of history

Use: Pagination, Server-side filtering, Efficient indexes, Lazy loading, Thumbnail generation, Search indexes where appropriate.

Do not load an entire client portfolio into the browser unnecessarily.

## 80. UX Requirements

The system must work well on Desktop, Tablet, Phone.

Field workflow requirements:

* Large tap targets
* Minimal typing
* Smart defaults
* Autosave
* Camera integration
* Fast navigation
* Persistent search
* Clear breadcrumbs
* Strong status indicators

Do not force inspectors to navigate through excessive screens for common actions.

An inspector should be able to update Condition, Label status, Quantity, Notes, Photos, Repair recommendation directly within the inspection workflow.

**Accessibility:** Given the likely mix of institutional, government, and school-district clients (AHERA applies specifically to K-12 and higher-ed buildings), the internal application and especially the client portal should target WCAG 2.1 AA conformance — keyboard navigation, screen-reader-compatible forms, sufficient color contrast for status indicators, and non-color-only status coding (condition/priority indicators should never rely on color alone, given colorblind users and black-and-white printed reports).

## 81. Inventory Record UX

When opening an inventory item, immediately show:

**Current Status** — Material, ACM classification, Quantity remaining, Condition, Label status, Recommended response

**Visual Documentation** — Primary photo, Latest inspection photo, Damage photos

**Supporting Evidence** — Samples, Laboratory results, Sample photos

**Compliance Activity** — Latest inspection, Open repairs, Repair photographs, Removal history

**Documentation** — Reports, Floor plans, Documents

**History** — Full timeline, Quantity changes, Condition changes, Photo history, Repairs, Removal

This should effectively become the item's **Digital Asbestos Record**.

## 82. Global Building Activity Timeline

Each building should have a chronological activity feed.

Example:
August 12, 2026 — Annual inspection completed.
August 10, 2026 — Sample 26-104 collected.
August 7, 2026 — Pipe insulation repair completed.
July 22, 2026 — 250 SF floor tile removed.

Allow filtering by: Inspection, Sample, Repair, Inventory, Removal, Document, Photo

## 83. Seed / Demo Data

Create realistic demonstration data containing:

* 2 clients
* 3 facilities
* 8 buildings
* Multiple floors
* Approximately 50 inventory records
* Positive samples
* Negative samples
* Layered samples
* New suspect materials
* Open repairs
* Completed repairs
* Removed materials
* Upcoming inspections
* Overdue inspections
* Sample photos
* Inventory photos
* Repair before/after photos
* Uploaded documents

Include realistic materials such as: Pipe insulation, Pipe fitting insulation, Floor tile, Floor tile mastic, Ceiling tile, Plaster, Fireproofing, Transite panels, Roofing, Window glazing, Caulk, Boiler insulation.

## 84. Development Approach

Before coding:

1. Review all requirements.
2. Inspect the existing repository if one exists.
3. Identify existing authentication and permissions.
4. Design the relational schema.
5. Define organization/client isolation.
6. Define sample-to-inventory relationships.
7. Define photo relationships.
8. Define inspection workflow.
9. Define repair workflow.
10. Define removal workflow.
11. Define document architecture.
12. Define audit architecture.
13. Define API architecture.
14. Define client portal permissions.
15. Produce an implementation plan.

Do not immediately start generating disconnected pages.

## 85. Recommended Development Phases

**Phase 1 — Platform Foundation** — Authentication, Organizations, Roles, Permissions, Clients, Facilities, Buildings

**Phase 2 — Core Inventory** — Building hierarchy, Homogeneous areas, Inventory, Quantity history, Condition history, Inventory photos

**Phase 3 — Sampling** — Samples, Sample photos, Sample layers, Laboratories, Laboratory results, Chain of custody

**Phase 4 — Reconciliation** — Result review, Sample-to-inventory linking, New inventory generation, Supporting sample relationships

**Phase 5 — Inspections** — Templates, Scheduling, Mobile inspections, Inspection photos, Printable inspection forms, Signatures

**Phase 6 — Repairs** — Response actions, Repair workflow, Before/during/after photos, Verification

**Phase 7 — Removal** — Partial removal, Complete removal, Quantity reconciliation, Removal documentation, Removal photographs

**Phase 8 — Documents and Floor Plans** — Document management, Floor plans, Map markers, QR codes

**Phase 9 — Client Portal** — Client dashboards, Inventory access, Reports, Documents, Configurable photo access

**Phase 10 — Operations** — Compliance Queue, Inspector Workspace, Tasks, Notifications, Saved views, Search

**Phase 11 — Reporting** — PDF generation, Excel exports, Management plans, Photo-enabled reports

**Phase 12 — Compliance & Personnel Extensions** — Certification/licensing tracking (§87), regulatory notification tracking (§88), occupational exposure monitoring (§89), incident/emergency workflow (§90)

**Phase 13 — Advanced Capabilities** — Offline support, GIS, APIs, Laboratory integrations, AI-assisted workflows

## 86. Development Quality Requirements

Do not create placeholder pages that look functional but lack backend functionality.

Each module should have: Database schema, Validation, API/service layer, Permissions, UI, Error handling, Audit logging, Tests.

Complete each vertical workflow before moving to cosmetic expansion.

For example, the sample workflow is not complete until this works:
Create Sample → Upload Photos → Generate Chain of Custody → Enter Result → Upload Lab Report → Review Result → Reconcile Result → Create/Update Inventory → See Sample in Inventory History

Likewise, a repair workflow is not complete until:
Identify Damage → Photograph Damage → Create Repair → Assign Repair → Upload Work Documentation → Add After Photos → Verify Repair → Update Material Condition → Preserve Complete History

## 87. Certification and Licensing Tracking (Added)

Inspectors, management planners, project designers, supervisors, and abatement workers typically require jurisdiction-specific certifications (e.g., EPA AHERA Building Inspector, Management Planner, Project Designer, Abatement Worker/Supervisor courses, plus state-specific licenses) that expire annually or on a fixed cycle. This is a common audit failure point and deserves first-class tracking rather than a generic document upload.

Track, per user:

* Certification type (configurable by jurisdiction)
* Issuing body / course provider
* Certificate number
* Issue date
* Expiration date
* Supporting document (scanned certificate)
* State(s)/jurisdiction(s) the certification is valid in

System behavior:

* Block or flag an inspection, sample collection, or repair-verification action performed by a user whose relevant certification is expired at the time of the action.
* Surface expiring certifications (30/60/90-day warnings) in the Compliance Queue (§54) and via notifications (§56).
* Certification status should be visible on the user's profile and queryable in reports (e.g., "which inspectors are certified to work in this state").
* Historical certifications must be preserved, not overwritten, when renewed — mirroring the no-destructive-overwrite principle used elsewhere in this spec.

## 88. Regulatory Notification Tracking (Added)

Distinct from a generic uploaded "notification" document (§43), NESHAP demolition/renovation notifications and equivalent state filings carry hard deadlines (commonly 10+ working days before work begins) and are filed with specific regulatory authorities. Missing or late notifications are a leading cause of enforcement action.

Create a dedicated `regulatory_notifications` entity, linked to a building and/or removal/abatement project, tracking:

* Notification type (e.g., NESHAP demolition, NESHAP renovation, state-specific filing)
* Regulatory authority / agency
* Required submission deadline (computed from planned work start date and jurisdiction rule)
* Submission date
* Submission method (mail, portal, fax, email)
* Confirmation number / receipt
* Amendment history (start-date changes require re-notification in many jurisdictions)
* Status: Not Required, Pending, Submitted, Confirmed, Amended, Late

System behavior:

* Auto-calculate the notification deadline from the jurisdiction's configured lead time (§64) once a removal project's planned start date is set, and surface it in the Compliance Queue.
* Warn prominently if a removal/abatement project is scheduled to begin before a required notification has been confirmed submitted.
* Never auto-submit a notification to a regulator — this is a human-authored and human-submitted action; the system tracks and reminds only (consistent with §65's stance against automated compliance determinations).

## 89. Occupational Exposure Monitoring (Added)

Distinct from repair/removal clearance air monitoring (§30–34), OSHA 1926.1101 and 1910.1001 require personal exposure monitoring (PEL/TWA/Excursion Limit) for workers who may be exposed to airborne asbestos, with specific recordkeeping and retention requirements (typically 30+ years, or duration of employment plus 30 years).

Create an `exposure_monitoring_records` entity tracking, per monitored worker and sampling event:

* Worker (name, employer, job classification)
* Building / project
* Sample date and duration
* Sample type (personal, area, excursion)
* Result (fibers/cc)
* Applicable exposure limit (PEL 8-hr TWA, Excursion Limit)
* Exceedance flag
* Respiratory protection used
* Medical surveillance linkage (if tracked)
* Lab report

This is a personnel record, not a material record — keep it in its own workspace/permission boundary distinct from the building/material inventory, since access to worker exposure history should typically be restricted to safety/EHS roles and the worker's employer, not the general inventory-viewing audience.

## 90. Incident / Emergency Fiber-Release Workflow (Added)

A planned repair (§30) and a sudden, unplanned fiber-release episode (pipe strike, ceiling collapse, accidental disturbance during unrelated maintenance) have different urgency, notification, and response requirements. Modeling both through the same "repair" entity understates the urgency of the latter.

Create a distinct `incidents` entity (or an `incident` flag/type on repairs, if reusing the repair workflow) that:

* Can be created outside of a scheduled inspection, by any authorized user, with a prominent "Report an Incident" entry point.
* Captures: date/time discovered, discovered by, location, estimated area affected, immediate actions taken (evacuation, area sealed), photos, whether the area was occupied at time of release.
* Triggers immediate notification (§56) to environmental manager/safety roles regardless of normal digest timing.
* Links to the affected inventory item(s) once identified, and to any resulting repair/removal/air-monitoring records, so the incident remains in that material's permanent history (§45).
* Does not require photos to be blocked by building photography restrictions (§29) — clarify in configuration whether emergency documentation is exempt from a "Photography Prohibited" building policy, since safety documentation needs may override routine photo restrictions; if not exempted, this should be a conscious client-level decision, not a default.

## 91. Additional Notes on Scope (Added)

A few items are flagged here as considerations for later phases rather than requirements for initial build, since adding all of them to Phase 1 would blow up scope:

* **Cost / capital planning rollups** — Many management plans (§58) track a replacement-reserve or budget estimate tied to inventory items over time (e.g., "expected removal cost if X material must be abated during planned renovation"). This is a natural extension of the existing cost fields in the repair module (§30) but scoped to portfolio-level planning rather than per-repair tracking. Treat as Phase 12+.
* **Multi-language inspection forms** — If the field workforce is not uniformly English-speaking, inspection templates (§25) and mobile inspection mode (§26) may need localized field labels. Flag as a configuration consideration for §64 rather than a Phase 1 requirement.
* **Data residency and right-to-export/delete for SaaS operation** — Beyond compliance record retention (§66), the platform itself, as a multi-tenant SaaS product, will likely need a client-initiated data export and a defined data-deletion policy for offboarded clients (distinct from internal compliance-record retention rules). Worth defining before onboarding any client with contractual data-handling requirements.
