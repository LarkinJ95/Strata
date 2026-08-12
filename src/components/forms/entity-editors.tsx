"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AccessField, Disclose } from "@/components/forms/access-field";
import {
  saveBuilding,
  saveClient,
  saveFacility,
  saveFloor,
  saveFunctionalArea,
  saveInspectionMeta,
  saveInventory,
  savePaintSample,
  savePpe,
  saveRepair,
  saveSample,
  deletePpe,
} from "@/actions/records";

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function ClientEditor({
  client,
}: {
  client?: {
    id?: string;
    name: string;
    clientNumber: string;
    primaryContact?: string | null;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    photoPolicy: string;
    inspectionReqs?: string | null;
    notes?: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <Disclose label={client?.id ? "Edit client" : "Add client"}>
      <form action={(formData) => start(async () => {
        if (!client?.id) {
          await saveClient(formData);
          return;
        }
        setMessage("");
        try {
          await saveClient(formData);
          setMessage("Client saved.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not save client.");
        }
      })} className="space-y-3">
        <AccessField />
        {client?.id && <input type="hidden" name="id" value={client.id} />}
        <Grid>
          <Field label="Name"><input name="name" defaultValue={client?.name} required /></Field>
          <Field label="Client number"><input name="clientNumber" defaultValue={client?.clientNumber} required /></Field>
          <Field label="Primary contact"><input name="primaryContact" defaultValue={client?.primaryContact ?? ""} /></Field>
          <Field label="Email"><input name="primaryEmail" defaultValue={client?.primaryEmail ?? ""} /></Field>
          <Field label="Phone"><input name="primaryPhone" defaultValue={client?.primaryPhone ?? ""} /></Field>
          <Field label="Photo policy">
            <select name="photoPolicy" defaultValue={client?.photoPolicy ?? "permitted"}>
              <option value="permitted">Permitted</option>
              <option value="limited">Limited</option>
              <option value="approval_required">Approval required</option>
              <option value="prohibited">Prohibited</option>
            </select>
          </Field>
          <Field label="Address"><input name="address" defaultValue={client?.address ?? ""} /></Field>
          <Field label="City"><input name="city" defaultValue={client?.city ?? ""} /></Field>
          <Field label="State"><input name="state" defaultValue={client?.state ?? ""} /></Field>
          <Field label="Postal code"><input name="postalCode" defaultValue={client?.postalCode ?? ""} /></Field>
        </Grid>
        <Field label="Inspection requirements"><textarea name="inspectionReqs" rows={2} defaultValue={client?.inspectionReqs ?? ""} /></Field>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={client?.notes ?? ""} /></Field>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : client?.id ? "Save client" : "Create client"}</button>
          {message && <span role="status" className={message.endsWith(".") && !message.startsWith("Could") && message !== "Not allowed" ? "text-sm text-teal-dim" : "text-sm text-status-action"}>{message}</span>}
        </div>
      </form>
    </Disclose>
  );
}

export function FacilityEditor({ clientId, facility }: { clientId: string; facility?: { id: string; name: string; facilityId: string; address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; primaryContact?: string | null; environmentalContact?: string | null; emergencyContact?: string | null; notes?: string | null; status: string } }) {
  return (
    <Disclose label={facility ? "Edit facility" : "Add facility"}>
      <form action={saveFacility} className="space-y-3">
        <AccessField />
        {facility && <input type="hidden" name="id" value={facility.id} />}
        <input type="hidden" name="clientId" value={clientId} />
        <Grid>
          <Field label="Name"><input name="name" defaultValue={facility?.name} required /></Field>
          <Field label="Facility ID"><input name="facilityId" defaultValue={facility?.facilityId} placeholder="MH-CC" required /></Field>
          <Field label="Address"><input name="address" defaultValue={facility?.address ?? ""} /></Field>
          <Field label="City"><input name="city" defaultValue={facility?.city ?? ""} /></Field>
          <Field label="State"><input name="state" defaultValue={facility?.state ?? ""} /></Field>
          <Field label="Postal code"><input name="postalCode" defaultValue={facility?.postalCode ?? ""} /></Field>
          <Field label="Primary contact"><input name="primaryContact" defaultValue={facility?.primaryContact ?? ""} /></Field>
          <Field label="Environmental contact"><input name="environmentalContact" defaultValue={facility?.environmentalContact ?? ""} /></Field>
          <Field label="Emergency contact"><input name="emergencyContact" defaultValue={facility?.emergencyContact ?? ""} /></Field>
          <Field label="Status"><select name="status" defaultValue={facility?.status ?? "active"}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={facility?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{facility ? "Save facility" : "Create facility"}</button>
      </form>
    </Disclose>
  );
}

export function BuildingEditor({
  building,
  facilityId,
}: {
  facilityId?: string;
  building?: {
    id?: string;
    name: string;
    buildingNumber: string;
    address?: string | null;
    yearConstructed?: number | null;
    squareFootage?: number | null;
    floorsCount?: number | null;
    buildingUse?: string | null;
    occupancyStatus: string;
    photoPolicy: string;
    surveyStatus: string;
    managementPlanStatus: string;
    notes?: string | null;
    lastInspectionAt?: Date | null;
    nextInspectionAt?: Date | null;
  };
}) {
  const d = (v?: Date | null) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  return (
    <Disclose label={building?.id ? "Edit building profile" : "Add building"}>
      <form action={saveBuilding} className="space-y-3">
        <AccessField />
        {building?.id && <input type="hidden" name="id" value={building.id} />}
        {facilityId && <input type="hidden" name="facilityId" value={facilityId} />}
        <Grid>
          <Field label="Name"><input name="name" defaultValue={building?.name} required /></Field>
          <Field label="Building number"><input name="buildingNumber" defaultValue={building?.buildingNumber} required /></Field>
          <Field label="Address"><input name="address" defaultValue={building?.address ?? ""} /></Field>
          <Field label="Year built"><input name="yearConstructed" type="number" defaultValue={building?.yearConstructed ?? ""} /></Field>
          <Field label="Square footage"><input name="squareFootage" type="number" defaultValue={building?.squareFootage ?? ""} /></Field>
          <Field label="Floors"><input name="floorsCount" type="number" defaultValue={building?.floorsCount ?? ""} /></Field>
          <Field label="Use"><input name="buildingUse" defaultValue={building?.buildingUse ?? ""} /></Field>
          <Field label="Occupancy">
            <select name="occupancyStatus" defaultValue={building?.occupancyStatus ?? "occupied"}>
              <option value="occupied">Occupied</option>
              <option value="vacant">Vacant</option>
              <option value="renovation">Renovation</option>
            </select>
          </Field>
          <Field label="Photo policy">
            <select name="photoPolicy" defaultValue={building?.photoPolicy ?? "permitted"}>
              <option value="permitted">Permitted</option>
              <option value="limited">Limited</option>
              <option value="approval_required">Approval required</option>
              <option value="prohibited">Prohibited</option>
            </select>
          </Field>
          <Field label="Survey status"><input name="surveyStatus" defaultValue={building?.surveyStatus ?? "complete"} /></Field>
          <Field label="Management plan"><input name="managementPlanStatus" defaultValue={building?.managementPlanStatus ?? "current"} /></Field>
          <Field label="Last inspection"><input name="lastInspectionAt" type="date" defaultValue={d(building?.lastInspectionAt)} /></Field>
          <Field label="Next inspection"><input name="nextInspectionAt" type="date" defaultValue={d(building?.nextInspectionAt)} /></Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={building?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{building?.id ? "Save building" : "Create building"}</button>
      </form>
    </Disclose>
  );
}

export function InventoryEditor({
  buildingId,
  item,
}: {
  buildingId: string;
  item?: {
    id: string;
    materialDescription: string;
    materialCategory: string;
    floor: string | null;
    room: string | null;
    specificLocation: string | null;
    acmClassification: string;
    condition: string;
    currentQuantity: number | null;
    quantityUnit: string;
    asbestosPercent: number | null;
    labelCondition: string | null;
    responseAction: string | null;
    friable: string | null;
    notes: string | null;
    recordStatus: string;
  };
}) {
  return (
    <Disclose label={item ? `Edit ${item.materialDescription}` : "Add inventory material"}>
      <form action={saveInventory} className="space-y-3">
        <AccessField />
        {item && <input type="hidden" name="id" value={item.id} />}
        <input type="hidden" name="buildingId" value={buildingId} />
        <Grid>
          <Field label="Material"><input name="materialDescription" defaultValue={item?.materialDescription ?? ""} required /></Field>
          <Field label="Category">
            <select name="materialCategory" defaultValue={item?.materialCategory ?? "Miscellaneous"}>
              <option>Thermal System Insulation</option>
              <option>Surfacing</option>
              <option>Miscellaneous</option>
            </select>
          </Field>
          <Field label="Floor"><input name="floor" defaultValue={item?.floor ?? ""} /></Field>
          <Field label="Room"><input name="room" defaultValue={item?.room ?? ""} /></Field>
          <Field label="Specific location"><input name="specificLocation" defaultValue={item?.specificLocation ?? ""} /></Field>
          <Field label="Classification">
            <select name="acmClassification" defaultValue={item?.acmClassification ?? "unknown"}>
              <option value="confirmed_acm">Confirmed ACM</option>
              <option value="assumed_acm">Assumed ACM</option>
              <option value="pacm">PACM</option>
              <option value="non_acm">Non-ACM</option>
              <option value="unknown">Unknown</option>
              <option value="removed">Removed</option>
            </select>
          </Field>
          <Field label="Condition">
            <select name="condition" defaultValue={item?.condition ?? "good"}>
              {["good", "fair", "damaged", "significantly_damaged", "needs_repair", "removed", "inaccessible"].map((c) => (
                <option key={c} value={c}>{c.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Quantity"><input name="currentQuantity" type="number" step="0.1" defaultValue={item?.currentQuantity ?? ""} /></Field>
          <Field label="Unit">
            <select name="quantityUnit" defaultValue={item?.quantityUnit ?? "SF"}>
              {["SF", "LF", "CF", "EA", "Units"].map((u) => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="% asbestos"><input name="asbestosPercent" type="number" step="0.1" defaultValue={item?.asbestosPercent ?? ""} /></Field>
          <Field label="Friable">
            <select name="friable" defaultValue={item?.friable ?? ""}>
              <option value="">—</option>
              <option value="friable">Friable</option>
              <option value="non_friable">Non-friable</option>
            </select>
          </Field>
          <Field label="Label"><input name="labelCondition" defaultValue={item?.labelCondition ?? ""} /></Field>
          <Field label="Response"><input name="responseAction" defaultValue={item?.responseAction ?? ""} /></Field>
          <Field label="Status">
            <select name="recordStatus" defaultValue={item?.recordStatus ?? "active"}>
              <option value="active">Active</option>
              <option value="removed">Removed</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{item ? "Save material" : "Add material"}</button>
      </form>
    </Disclose>
  );
}

export function SampleEditor({
  buildingId,
  sample,
}: {
  buildingId: string;
  sample?: { id: string; material: string; floor: string | null; room: string | null; location: string | null; status: string; notes: string | null };
}) {
  return (
    <Disclose label={sample ? `Edit sample ${sample.material}` : "Add sample"}>
      <form action={saveSample} className="space-y-3">
        <AccessField />
        {sample && <input type="hidden" name="id" value={sample.id} />}
        <input type="hidden" name="buildingId" value={buildingId} />
        <Grid>
          <Field label="Material"><input name="material" defaultValue={sample?.material ?? ""} required /></Field>
          <Field label="Floor"><input name="floor" defaultValue={sample?.floor ?? ""} /></Field>
          <Field label="Room"><input name="room" defaultValue={sample?.room ?? ""} /></Field>
          <Field label="Location"><input name="location" defaultValue={sample?.location ?? ""} /></Field>
          <Field label="Status">
            <select name="status" defaultValue={sample?.status ?? "collected"}>
              {["collected", "submitted", "at_lab", "results_received", "reviewed", "reconciled"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={sample?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{sample ? "Save sample" : "Add sample"}</button>
      </form>
    </Disclose>
  );
}

export function RepairEditor({
  repair,
  inventoryOptions,
}: {
  inventoryOptions: { id: string; inventoryCode: string; materialDescription: string }[];
  repair?: {
    id: string;
    problem: string;
    priority: string;
    status: string;
    recommendedResponse: string | null;
    workOrderNumber: string | null;
    scheduledDate: Date | null;
    notes: string | null;
  };
}) {
  return (
    <Disclose label={repair ? "Edit repair" : "Add repair"}>
      <form action={saveRepair} className="space-y-3">
        <AccessField />
        {repair && <input type="hidden" name="id" value={repair.id} />}
        {!repair && (
          <Field label="Inventory item">
            <select name="inventoryItemId" required>
              {inventoryOptions.map((i) => (
                <option key={i.id} value={i.id}>{i.inventoryCode} · {i.materialDescription}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Problem"><textarea name="problem" rows={2} defaultValue={repair?.problem ?? ""} required /></Field>
        <Grid>
          <Field label="Priority">
            <select name="priority" defaultValue={repair?.priority ?? "medium"}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={repair?.status ?? "open"}>
              {["open", "assigned", "scheduled", "in_progress", "awaiting_verification", "completed", "closed", "cancelled"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Response"><input name="recommendedResponse" defaultValue={repair?.recommendedResponse ?? ""} /></Field>
          <Field label="Work order"><input name="workOrderNumber" defaultValue={repair?.workOrderNumber ?? ""} /></Field>
          <Field label="Scheduled">
            <input name="scheduledDate" type="date" defaultValue={repair?.scheduledDate ? new Date(repair.scheduledDate).toISOString().slice(0, 10) : ""} />
          </Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={repair?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{repair ? "Save repair" : "Add repair"}</button>
      </form>
    </Disclose>
  );
}

export function FloorEditor({
  buildingId,
  floor,
}: {
  buildingId: string;
  floor?: { id: string; name: string; level: number; occupancy: string | null; squareFootage: number | null; notes: string | null };
}) {
  return (
    <Disclose label={floor ? `Edit ${floor.name}` : "Add floor"}>
      <form action={saveFloor} className="space-y-3">
        <AccessField />
        <input type="hidden" name="buildingId" value={buildingId} />
        {floor && <input type="hidden" name="id" value={floor.id} />}
        <Grid>
          <Field label="Name"><input name="name" defaultValue={floor?.name ?? ""} required placeholder="Level 2" /></Field>
          <Field label="Level #"><input name="level" type="number" defaultValue={floor?.level ?? 1} /></Field>
          <Field label="Occupancy"><input name="occupancy" defaultValue={floor?.occupancy ?? ""} placeholder="Patient care / vacant" /></Field>
          <Field label="Square footage"><input name="squareFootage" type="number" defaultValue={floor?.squareFootage ?? ""} /></Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={floor?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{floor ? "Save floor" : "Add floor"}</button>
      </form>
    </Disclose>
  );
}

export function FunctionalAreaEditor({
  buildingId,
  floors,
  area,
}: {
  buildingId: string;
  floors: { id: string; name: string }[];
  area?: { id: string; name: string; faCode: string | null; floorId: string | null; areaType: string | null; useDescription: string | null; notes: string | null };
}) {
  return (
    <Disclose label={area ? `Edit FA ${area.faCode || area.name}` : "Add functional area / room"}>
      <form action={saveFunctionalArea} className="space-y-3">
        <AccessField />
        <input type="hidden" name="buildingId" value={buildingId} />
        {area && <input type="hidden" name="id" value={area.id} />}
        <Grid>
          <Field label="FA / room name"><input name="name" defaultValue={area?.name ?? ""} required placeholder="Mechanical Room 01" /></Field>
          <Field label="FA code"><input name="faCode" defaultValue={area?.faCode ?? ""} placeholder="FA-B1-MECH" /></Field>
          <Field label="Floor">
            <select name="floorId" defaultValue={area?.floorId ?? ""}>
              <option value="">Unassigned</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select name="areaType" defaultValue={area?.areaType ?? "room"}>
              {["room", "corridor", "mechanical", "stair", "exterior", "roof", "plenum", "confined_space", "other"].map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
        </Grid>
        <Field label="Use / description"><input name="useDescription" defaultValue={area?.useDescription ?? ""} /></Field>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={area?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{area ? "Save FA" : "Add FA"}</button>
      </form>
    </Disclose>
  );
}

export function PaintSampleEditor({
  buildingId,
  floors,
  areas,
  sample,
}: {
  buildingId: string;
  floors: { id: string; name: string }[];
  areas: { id: string; name: string; faCode: string | null }[];
  sample?: {
    id: string;
    floorId: string | null;
    areaId: string | null;
    floor: string | null;
    room: string | null;
    location: string | null;
    component: string | null;
    color: string | null;
    substrate: string | null;
    laboratory: string | null;
    method: string | null;
    leadDetected: boolean | null;
    leadPpm: number | null;
    leadMgCm2: number | null;
    asbestosPaint: boolean | null;
    resultSummary: string | null;
    status: string;
    notes: string | null;
    collectionDate: Date;
  };
}) {
  return (
    <Disclose label={sample ? "Edit paint sample" : "Add paint sample result"}>
      <form action={savePaintSample} className="space-y-3">
        <AccessField />
        <input type="hidden" name="buildingId" value={buildingId} />
        {sample && <input type="hidden" name="id" value={sample.id} />}
        <Grid>
          <Field label="Floor record">
            <select name="floorId" defaultValue={sample?.floorId ?? ""}>
              <option value="">—</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Functional area">
            <select name="areaId" defaultValue={sample?.areaId ?? ""}>
              <option value="">—</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.faCode ? `${a.faCode} · ` : ""}{a.name}</option>)}
            </select>
          </Field>
          <Field label="Floor text"><input name="floor" defaultValue={sample?.floor ?? ""} /></Field>
          <Field label="Room"><input name="room" defaultValue={sample?.room ?? ""} /></Field>
          <Field label="Location"><input name="location" defaultValue={sample?.location ?? ""} /></Field>
          <Field label="Component">
            <select name="component" defaultValue={sample?.component ?? "wall"}>
              {["wall", "ceiling", "window", "door", "trim", "radiator", "stair", "exterior", "other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Color"><input name="color" defaultValue={sample?.color ?? ""} /></Field>
          <Field label="Substrate"><input name="substrate" defaultValue={sample?.substrate ?? ""} placeholder="Plaster / wood / metal" /></Field>
          <Field label="Method">
            <select name="method" defaultValue={sample?.method ?? "XRF"}>
              <option>XRF</option>
              <option>AAS</option>
              <option>ICP</option>
              <option>Paint chip</option>
              <option>PLM (asbestos in paint)</option>
            </select>
          </Field>
          <Field label="Lead detected">
            <select name="leadDetected" defaultValue={sample?.leadDetected == null ? "" : sample.leadDetected ? "yes" : "no"}>
              <option value="">Unknown</option>
              <option value="yes">Positive</option>
              <option value="no">Negative / below DL</option>
            </select>
          </Field>
          <Field label="Lead ppm"><input name="leadPpm" type="number" step="0.1" defaultValue={sample?.leadPpm ?? ""} /></Field>
          <Field label="Lead mg/cm²"><input name="leadMgCm2" type="number" step="0.01" defaultValue={sample?.leadMgCm2 ?? ""} /></Field>
          <Field label="Asbestos in paint">
            <select name="asbestosPaint" defaultValue={sample?.asbestosPaint == null ? "" : sample.asbestosPaint ? "yes" : "no"}>
              <option value="">Not analyzed</option>
              <option value="yes">Detected</option>
              <option value="no">Not detected</option>
            </select>
          </Field>
          <Field label="Lab"><input name="laboratory" defaultValue={sample?.laboratory ?? ""} /></Field>
          <Field label="Status">
            <select name="status" defaultValue={sample?.status ?? "results_received"}>
              <option value="collected">Collected</option>
              <option value="at_lab">At lab</option>
              <option value="results_received">Results received</option>
            </select>
          </Field>
          <Field label="Collected"><input name="collectionDate" type="date" defaultValue={sample ? new Date(sample.collectionDate).toISOString().slice(0, 10) : ""} /></Field>
        </Grid>
        <Field label="Result summary"><input name="resultSummary" defaultValue={sample?.resultSummary ?? ""} /></Field>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={sample?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{sample ? "Save paint sample" : "Add paint result"}</button>
      </form>
    </Disclose>
  );
}

export function PpeEditor({
  buildingId,
  item,
}: {
  buildingId: string;
  item?: { id: string; item: string; required: boolean; appliesTo: string | null; notes: string | null };
}) {
  return (
    <Disclose label={item ? `Edit ${item.item}` : "Add PPE requirement"}>
      <form action={savePpe} className="space-y-3">
        <AccessField />
        <input type="hidden" name="buildingId" value={buildingId} />
        {item && <input type="hidden" name="id" value={item.id} />}
        <Grid>
          <Field label="PPE item">
            <select name="item" defaultValue={item?.item ?? "Half-face respirator (P100)"}>
              {[
                "Half-face respirator (P100)",
                "Full-face respirator",
                "PAPR",
                "N95 (nuisance dust only)",
                "Tyvek / disposable coveralls",
                "Gloves (nitrile)",
                "Eye protection",
                "Boot covers",
                "Hard hat",
                "Hearing protection",
                "Fall protection",
                "Other",
              ].map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Required">
            <select name="required" defaultValue={item?.required === false ? "no" : "yes"}>
              <option value="yes">Required</option>
              <option value="no">Recommended / situational</option>
            </select>
          </Field>
          <Field label="Applies to"><input name="appliesTo" defaultValue={item?.appliesTo ?? "Entire building"} placeholder="Mechanical rooms / TSI work" /></Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} /></Field>
        <button className="btn btn-primary">{item ? "Save PPE" : "Add PPE"}</button>
      </form>
      {item && (
        <form action={deletePpe} className="mt-2">
          <AccessField />
          <input type="hidden" name="id" value={item.id} />
          <button className="btn btn-danger text-xs">Remove</button>
        </form>
      )}
    </Disclose>
  );
}

export function InspectionEditor({
  inspection,
}: {
  inspection: { id: string; inspectionType: string; status: string; notes: string | null; scheduledDate: Date | null };
}) {
  return (
    <Disclose label="Edit inspection">
      <form action={saveInspectionMeta} className="space-y-3">
        <AccessField />
        <input type="hidden" name="id" value={inspection.id} />
        <Grid>
          <Field label="Type">
            <select name="inspectionType" defaultValue={inspection.inspectionType}>
              {["annual_inspection", "periodic_surveillance", "reinspection", "limited_survey", "pre_renovation", "pre_demolition"].map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={inspection.status}>
              {["scheduled", "draft", "in_progress", "submitted", "completed"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Scheduled">
            <input name="scheduledDate" type="date" defaultValue={inspection.scheduledDate ? new Date(inspection.scheduledDate).toISOString().slice(0, 10) : ""} />
          </Field>
        </Grid>
        <Field label="Notes"><textarea name="notes" rows={2} defaultValue={inspection.notes ?? ""} /></Field>
        <button className="btn btn-primary">Save inspection</button>
      </form>
    </Disclose>
  );
}
