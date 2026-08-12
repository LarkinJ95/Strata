CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT,
    "logoPath" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "clientId" TEXT,
    "contractorId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "phone" TEXT,
    "avatarPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" DATETIME,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "UserBuildingAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "UserBuildingAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBuildingAccess_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientNumber" TEXT NOT NULL,
    "primaryContact" TEXT,
    "primaryEmail" TEXT,
    "primaryPhone" TEXT,
    "secondaryContact" TEXT,
    "secondaryEmail" TEXT,
    "secondaryPhone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "logoPath" TEXT,
    "notes" TEXT,
    "contractInfo" TEXT,
    "inspectionReqs" TEXT,
    "reportingReqs" TEXT,
    "documentReqs" TEXT,
    "notifyPrefs" TEXT,
    "photoPolicy" TEXT NOT NULL DEFAULT 'permitted',
    "customFields" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "primaryContact" TEXT,
    "environmentalContact" TEXT,
    "emergencyContact" TEXT,
    "notes" TEXT,
    "photoPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Facility_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buildingNumber" TEXT NOT NULL,
    "address" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "yearConstructed" INTEGER,
    "squareFootage" INTEGER,
    "floorsCount" INTEGER,
    "buildingUse" TEXT,
    "occupancyStatus" TEXT NOT NULL DEFAULT 'occupied',
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "renovationHistory" TEXT,
    "demolitionStatus" TEXT NOT NULL DEFAULT 'none',
    "surveyStatus" TEXT NOT NULL DEFAULT 'complete',
    "lastInspectionAt" DATETIME,
    "nextInspectionAt" DATETIME,
    "inspectionIntervalDays" INTEGER NOT NULL DEFAULT 365,
    "responsibleManagerId" TEXT,
    "managementPlanStatus" TEXT NOT NULL DEFAULT 'current',
    "photoPolicy" TEXT NOT NULL DEFAULT 'permitted',
    "contacts" TEXT,
    "notes" TEXT,
    "qrCode" TEXT,
    "complianceStatus" TEXT NOT NULL DEFAULT 'attention',
    "complianceReasons" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Building_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Building_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Building_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "BuildingFloor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "notes" TEXT,
    "qrCode" TEXT, "occupancy" TEXT, "squareFootage" INTEGER,
    CONSTRAINT "BuildingFloor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "BuildingArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT,
    "name" TEXT NOT NULL,
    "areaType" TEXT,
    "qrCode" TEXT,
    "notes" TEXT, "faCode" TEXT, "useDescription" TEXT,
    CONSTRAINT "BuildingArea_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildingArea_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "BuildingFloor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "HomogeneousArea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "haCode" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "materialDescription" TEXT,
    "floors" TEXT,
    "rooms" TEXT,
    "determination" TEXT NOT NULL DEFAULT 'unknown',
    "quantity" REAL,
    "quantityUnit" TEXT,
    "condition" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HomogeneousArea_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "homogeneousAreaId" TEXT,
    "inventoryCode" TEXT NOT NULL,
    "internalCode" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "area" TEXT,
    "specificLocation" TEXT,
    "materialCategory" TEXT NOT NULL,
    "materialDescription" TEXT NOT NULL,
    "acmClassification" TEXT NOT NULL,
    "asbestosDetected" BOOLEAN,
    "fiberTypes" TEXT NOT NULL DEFAULT '[]',
    "asbestosPercent" REAL,
    "friable" TEXT,
    "materialClass" TEXT,
    "categoryIorII" TEXT,
    "analyticalMethod" TEXT,
    "originalQuantity" REAL,
    "currentQuantity" REAL,
    "quantityRepaired" REAL NOT NULL DEFAULT 0,
    "quantityRemoved" REAL NOT NULL DEFAULT 0,
    "quantityUnit" TEXT NOT NULL,
    "quantityUncertainty" TEXT,
    "quantitySource" TEXT,
    "quantityNotes" TEXT,
    "condition" TEXT NOT NULL,
    "accessibility" TEXT,
    "disturbancePotential" TEXT,
    "labelPresent" BOOLEAN,
    "labelCondition" TEXT,
    "responseAction" TEXT,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "recordStatus" TEXT NOT NULL DEFAULT 'active',
    "latitude" REAL,
    "longitude" REAL,
    "floorPlanX" REAL,
    "floorPlanY" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_homogeneousAreaId_fkey" FOREIGN KEY ("homogeneousAreaId") REFERENCES "HomogeneousArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "InventoryQuantityHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "previousQty" REAL,
    "newQty" REAL NOT NULL,
    "delta" REAL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "notes" TEXT,
    "changedById" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryQuantityHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "InventoryConditionHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "previousCondition" TEXT,
    "newCondition" TEXT NOT NULL,
    "inspectionId" TEXT,
    "inspectorId" TEXT,
    "notes" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryConditionHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "InventoryLabelHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inventoryItemId" TEXT NOT NULL,
    "labelPresent" BOOLEAN,
    "labelCondition" TEXT,
    "labelReplaced" BOOLEAN NOT NULL DEFAULT false,
    "labelMissing" BOOLEAN NOT NULL DEFAULT false,
    "unableToReplace" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "inspectionId" TEXT,
    "changedById" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLabelHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Laboratory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accreditation" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    CONSTRAINT "Laboratory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "homogeneousAreaId" TEXT,
    "sampleNumber" TEXT NOT NULL,
    "clientSampleNumber" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "location" TEXT,
    "material" TEXT NOT NULL,
    "materialDescription" TEXT,
    "collectionDate" DATETIME NOT NULL,
    "collectionTime" TEXT,
    "inspectorId" TEXT,
    "samplingMethod" TEXT,
    "notes" TEXT,
    "laboratoryId" TEXT,
    "labSampleNumber" TEXT,
    "analysisMethod" TEXT,
    "dateReceived" DATETIME,
    "dateAnalyzed" DATETIME,
    "dateResultsReceived" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "cocId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sample_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sample_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sample_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sample_homogeneousAreaId_fkey" FOREIGN KEY ("homogeneousAreaId") REFERENCES "HomogeneousArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sample_cocId_fkey" FOREIGN KEY ("cocId") REFERENCES "ChainOfCustody" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "SampleLayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "layerNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "asbestosDetected" BOOLEAN,
    "asbestosPercent" REAL,
    "fiberTypes" TEXT NOT NULL DEFAULT '[]',
    "classification" TEXT,
    "comments" TEXT,
    "detectionLimit" TEXT,
    CONSTRAINT "SampleLayer_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SampleResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleLayerId" TEXT NOT NULL,
    "asbestosDetected" BOOLEAN NOT NULL,
    "asbestosPercent" REAL,
    "fiberTypes" TEXT NOT NULL DEFAULT '[]',
    "method" TEXT NOT NULL,
    "detectionLimit" TEXT,
    "analystComments" TEXT,
    "labComments" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "conflicting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleResult_sampleLayerId_fkey" FOREIGN KEY ("sampleLayerId") REFERENCES "SampleLayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "SampleInventoryLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "layerNumber" INTEGER,
    "linkType" TEXT NOT NULL DEFAULT 'supporting',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleInventoryLink_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SampleInventoryLink_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ChainOfCustody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT,
    "projectName" TEXT,
    "inspectorId" TEXT,
    "laboratoryId" TEXT,
    "analysisRequested" TEXT,
    "relinquishedBy" TEXT,
    "relinquishedAt" DATETIME,
    "receivedBy" TEXT,
    "receivedAt" DATETIME,
    "shippingMethod" TEXT,
    "trackingNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainOfCustody_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChainOfCustody_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChainOfCustody_laboratoryId_fkey" FOREIGN KEY ("laboratoryId") REFERENCES "Laboratory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "templateName" TEXT,
    "scheduledDate" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "inspectorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "previousInspectionId" TEXT,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "findings" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inspection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "previousCondition" TEXT,
    "currentCondition" TEXT,
    "previousLabel" TEXT,
    "currentLabel" TEXT,
    "quantityObserved" REAL,
    "materialRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedQuantity" REAL,
    "notes" TEXT,
    "inspected" BOOLEAN NOT NULL DEFAULT false,
    "inspectedAt" DATETIME,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "photosSatisfied" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "SuspectMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT,
    "buildingId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "floor" TEXT,
    "room" TEXT,
    "location" TEXT,
    "material" TEXT NOT NULL,
    "estimatedQty" REAL,
    "unit" TEXT,
    "condition" TEXT,
    "friability" TEXT,
    "action" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuspectMaterial_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SuspectMaterial_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "repairCode" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "condition" TEXT,
    "identifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "recommendedResponse" TEXT,
    "assignedContractorId" TEXT,
    "assignedUserId" TEXT,
    "workOrderNumber" TEXT,
    "poNumber" TEXT,
    "estimatedCost" REAL,
    "scheduledDate" DATETIME,
    "completionDate" DATETIME,
    "completionNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Repair_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repair_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Repair_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Repair_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Repair_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Repair_assignedContractorId_fkey" FOREIGN KEY ("assignedContractorId") REFERENCES "Contractor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "RepairVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repairId" TEXT NOT NULL,
    "verificationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorId" TEXT,
    "satisfactory" BOOLEAN NOT NULL,
    "updatedCondition" TEXT,
    "updatedQuantity" REAL,
    "labelStatus" TEXT,
    "notes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RepairVerification_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "RemovalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityBefore" REAL NOT NULL,
    "quantityRemoved" REAL NOT NULL,
    "quantityRemaining" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "removedAt" DATETIME NOT NULL,
    "contractorId" TEXT,
    "projectNumber" TEXT,
    "workOrder" TEXT,
    "notificationNumber" TEXT,
    "wasteShipment" TEXT,
    "disposalFacility" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemovalEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemovalEvent_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemovalEvent_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RemovalEvent_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "license" TEXT,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    CONSTRAINT "Contractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ContractorAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "acknowledgedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryProvided" BOOLEAN NOT NULL DEFAULT true,
    "documentsProvided" TEXT,
    "signatureId" TEXT,
    "expiresAt" DATETIME,
    "notes" TEXT,
    CONSTRAINT "ContractorAcknowledgement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractorAcknowledgement_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractorAcknowledgement_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "buildingId" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "capturedAt" DATETIME,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "photographerId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "exifJson" TEXT,
    CONSTRAINT "Photo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Photo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Photo_photographerId_fkey" FOREIGN KEY ("photographerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "PhotoLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "caption" TEXT,
    "notes" TEXT,
    "primaryPhoto" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'inherit',
    "inventoryItemId" TEXT,
    "inspectionId" TEXT,
    "repairId" TEXT,
    "removalId" TEXT,
    "sampleId" TEXT,
    CONSTRAINT "PhotoLink_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PhotoLink_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoLink_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoLink_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoLink_removalId_fkey" FOREIGN KEY ("removalId") REFERENCES "RemovalEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhotoLink_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "PhotoAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "annotationData" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoAnnotation_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "buildingId" TEXT,
    "inventoryItemId" TEXT,
    "sampleId" TEXT,
    "inspectionId" TEXT,
    "repairId" TEXT,
    "removalId" TEXT,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "documentDate" DATETIME,
    "description" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'internal',
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "facilityId" TEXT,
    CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_removalId_fkey" FOREIGN KEY ("removalId") REFERENCES "RemovalEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Document_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "FloorPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FloorPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FloorPlan_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FloorPlan_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "BuildingFloor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "FloorPlanMarker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorPlanId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "markerType" TEXT NOT NULL DEFAULT 'pin',
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "label" TEXT,
    "geometryJson" TEXT,
    CONSTRAINT "FloorPlanMarker_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "FloorPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "buildingId" TEXT,
    "inventoryItemId" TEXT,
    "sampleId" TEXT,
    "inspectionId" TEXT,
    "repairId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "dueDate" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "signerName" TEXT NOT NULL,
    "signerRole" TEXT,
    "signatureData" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meaning" TEXT,
    "userId" TEXT,
    CONSTRAINT "Signature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Signature_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Signature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "relatedInspectionId" TEXT,
    "relatedDocumentId" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "buildingId" TEXT,
    "inventoryItemId" TEXT,
    "sampleId" TEXT,
    "inspectionId" TEXT,
    "repairId" TEXT,
    "removalId" TEXT,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_removalId_fkey" FOREIGN KEY ("removalId") REFERENCES "RemovalEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SavedView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "RegulatoryProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "config" TEXT NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RegulatoryProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "storageKey" TEXT,
    "params" TEXT NOT NULL DEFAULT '{}',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT,
    CONSTRAINT "GeneratedReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "filename" TEXT,
    "mapping" TEXT,
    "summary" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Role_organizationId_idx" ON "Role"("organizationId");
CREATE UNIQUE INDEX "Role_organizationId_slug_key" ON "Role"("organizationId", "slug");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "User_clientId_idx" ON "User"("clientId");
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "UserBuildingAccess_userId_buildingId_key" ON "UserBuildingAccess"("userId", "buildingId");
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");
CREATE UNIQUE INDEX "Client_organizationId_clientNumber_key" ON "Client"("organizationId", "clientNumber");
CREATE INDEX "Facility_organizationId_clientId_idx" ON "Facility"("organizationId", "clientId");
CREATE UNIQUE INDEX "Facility_organizationId_facilityId_key" ON "Facility"("organizationId", "facilityId");
CREATE INDEX "Building_organizationId_facilityId_idx" ON "Building"("organizationId", "facilityId");
CREATE INDEX "Building_nextInspectionAt_idx" ON "Building"("nextInspectionAt");
CREATE UNIQUE INDEX "Building_organizationId_clientId_buildingNumber_key" ON "Building"("organizationId", "clientId", "buildingNumber");
CREATE INDEX "BuildingFloor_buildingId_idx" ON "BuildingFloor"("buildingId");
CREATE INDEX "BuildingArea_buildingId_idx" ON "BuildingArea"("buildingId");
CREATE INDEX "HomogeneousArea_buildingId_idx" ON "HomogeneousArea"("buildingId");
CREATE UNIQUE INDEX "HomogeneousArea_buildingId_haCode_key" ON "HomogeneousArea"("buildingId", "haCode");
CREATE INDEX "InventoryItem_organizationId_buildingId_idx" ON "InventoryItem"("organizationId", "buildingId");
CREATE INDEX "InventoryItem_acmClassification_idx" ON "InventoryItem"("acmClassification");
CREATE INDEX "InventoryItem_condition_idx" ON "InventoryItem"("condition");
CREATE INDEX "InventoryItem_recordStatus_idx" ON "InventoryItem"("recordStatus");
CREATE UNIQUE INDEX "InventoryItem_organizationId_inventoryCode_key" ON "InventoryItem"("organizationId", "inventoryCode");
CREATE INDEX "InventoryQuantityHistory_inventoryItemId_idx" ON "InventoryQuantityHistory"("inventoryItemId");
CREATE INDEX "InventoryConditionHistory_inventoryItemId_idx" ON "InventoryConditionHistory"("inventoryItemId");
CREATE INDEX "InventoryLabelHistory_inventoryItemId_idx" ON "InventoryLabelHistory"("inventoryItemId");
CREATE INDEX "Sample_organizationId_buildingId_idx" ON "Sample"("organizationId", "buildingId");
CREATE INDEX "Sample_status_idx" ON "Sample"("status");
CREATE UNIQUE INDEX "Sample_organizationId_sampleNumber_key" ON "Sample"("organizationId", "sampleNumber");
CREATE UNIQUE INDEX "SampleLayer_sampleId_layerNumber_key" ON "SampleLayer"("sampleId", "layerNumber");
CREATE UNIQUE INDEX "SampleResult_sampleLayerId_key" ON "SampleResult"("sampleLayerId");
CREATE UNIQUE INDEX "SampleInventoryLink_sampleId_inventoryItemId_layerNumber_key" ON "SampleInventoryLink"("sampleId", "inventoryItemId", "layerNumber");
CREATE INDEX "Inspection_organizationId_buildingId_idx" ON "Inspection"("organizationId", "buildingId");
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");
CREATE INDEX "Inspection_scheduledDate_idx" ON "Inspection"("scheduledDate");
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");
CREATE UNIQUE INDEX "InspectionItem_inspectionId_inventoryItemId_key" ON "InspectionItem"("inspectionId", "inventoryItemId");
CREATE INDEX "Repair_organizationId_buildingId_idx" ON "Repair"("organizationId", "buildingId");
CREATE INDEX "Repair_status_idx" ON "Repair"("status");
CREATE UNIQUE INDEX "Repair_organizationId_repairCode_key" ON "Repair"("organizationId", "repairCode");
CREATE UNIQUE INDEX "RepairVerification_repairId_key" ON "RepairVerification"("repairId");
CREATE INDEX "RemovalEvent_organizationId_buildingId_idx" ON "RemovalEvent"("organizationId", "buildingId");
CREATE INDEX "PhotoLink_recordType_recordId_idx" ON "PhotoLink"("recordType", "recordId");
CREATE INDEX "PhotoLink_photoId_idx" ON "PhotoLink"("photoId");
CREATE INDEX "Document_organizationId_buildingId_idx" ON "Document"("organizationId", "buildingId");
CREATE INDEX "Document_docType_idx" ON "Document"("docType");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX "AuditEvent_organizationId_recordType_recordId_idx" ON "AuditEvent"("organizationId", "recordType", "recordId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX "ActivityEvent_organizationId_buildingId_createdAt_idx" ON "ActivityEvent"("organizationId", "buildingId", "createdAt");
CREATE TABLE "PaintSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorId" TEXT,
    "areaId" TEXT,
    "sampleNumber" TEXT NOT NULL,
    "floor" TEXT,
    "room" TEXT,
    "location" TEXT,
    "component" TEXT,
    "color" TEXT,
    "substrate" TEXT,
    "collectionDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "laboratory" TEXT,
    "method" TEXT,
    "leadDetected" BOOLEAN,
    "leadPpm" REAL,
    "leadMgCm2" REAL,
    "asbestosPaint" BOOLEAN,
    "resultSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'collected',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaintSample_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaintSample_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "BuildingFloor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaintSample_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "BuildingArea" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "BuildingPpe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "appliesTo" TEXT,
    "notes" TEXT,
    CONSTRAINT "BuildingPpe_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PaintSample_buildingId_idx" ON "PaintSample"("buildingId");
CREATE UNIQUE INDEX "PaintSample_buildingId_sampleNumber_key" ON "PaintSample"("buildingId", "sampleNumber");
CREATE INDEX "BuildingPpe_buildingId_idx" ON "BuildingPpe"("buildingId");
