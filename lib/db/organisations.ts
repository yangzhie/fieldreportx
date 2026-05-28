



// organisation.ts
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db as firestoreDb } from "@/lib/firebase";
import { Organisation } from "@/lib/types";
import { sqliteDb } from "./database";

const col = "organisations";

type SQLiteOrg = {
  id: string;
  name: string;
  abn: string;
  address: string;
  adminUid: string;
  memberUids: string;
  createdAt: number;
};

function fromRow(row: SQLiteOrg): Organisation {
  return {
    id: row.id,
    name: row.name,
    abn: row.abn,
    address: row.address,
    adminUid: row.adminUid,
    memberUids: JSON.parse(row.memberUids || "[]"),
    createdAt: row.createdAt,
  };
}

function toMs(value: any): number {
  if (typeof value === "number") return value;
  if (value?.toMillis) return value.toMillis();
  return Date.now();
}

async function cacheOrg(org: Organisation) {
  try {
    await sqliteDb.runAsync(
      `INSERT OR REPLACE INTO organisations
      (id, name, abn, address, adminUid, memberUids, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        org.id,
        org.name,
        org.abn,
        org.address,
        org.adminUid,
        JSON.stringify(org.memberUids || []),
        org.createdAt,
      ]
    );
  } catch {}
}

export async function createOrganisation(
  adminUid: string,
  data: { name: string; abn?: string; address?: string }
): Promise<string> {
  const ref = doc(collection(firestoreDb, col));

  const org: Organisation = {
    id: ref.id,
    name: data.name,
    abn: data.abn ?? "",
    address: data.address ?? "",
    adminUid,
    memberUids: [adminUid],
    createdAt: Date.now(),
  };

  await setDoc(ref, org);
  await cacheOrg(org);

  return ref.id;
}

export async function makeAdmin(orgId: string, uid: string): Promise<void> {
  await updateDoc(doc(firestoreDb, col, orgId), { adminUid: uid });
}

export async function leaveOrganisation(orgId: string, uid: string): Promise<void> {
  await updateDoc(doc(firestoreDb, col, orgId), {
    memberUids: arrayRemove(uid),
  });
}

export async function deleteOrganisation(orgId: string): Promise<void> {
  await deleteDoc(doc(firestoreDb, col, orgId));
  try {
    await sqliteDb.runAsync("DELETE FROM organisations WHERE id = ?", [orgId]);
  } catch {}
}

export async function getOrganisation(orgId: string) {
  const cached = await sqliteDb.getFirstAsync<SQLiteOrg>(
    "SELECT * FROM organisations WHERE id = ?",
    [orgId]
  );

  if (cached) return fromRow(cached);

  const snap = await getDoc(doc(firestoreDb, col, orgId));
  if (!snap.exists()) return null;

  const raw = snap.data();

  const org: Organisation = {
    id: snap.id,
    name: raw.name,
    abn: raw.abn,
    address: raw.address,
    adminUid: raw.adminUid,
    memberUids: raw.memberUids ?? [],
    createdAt: toMs(raw.createdAt),
  };

  await cacheOrg(org);
  return org;
}

export async function getUserOrganisation(uid: string) {
  const q = query(
    collection(firestoreDb, col),
    where("memberUids", "array-contains", uid)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      name: raw.name,
      abn: raw.abn,
      address: raw.address,
      adminUid: raw.adminUid,
      memberUids: raw.memberUids ?? [],
      createdAt: toMs(raw.createdAt),
    };
  });
}

export async function updateOrganisation(
  orgId: string,
  data: Partial<Pick<Organisation, "name" | "abn" | "address">>
) {
  await updateDoc(doc(firestoreDb, col, orgId), data);
}

export async function removeMember(orgId: string, uid: string) {
  await updateDoc(doc(firestoreDb, col, orgId), {
    memberUids: arrayRemove(uid),
  });
}

/**
 * Invite a user to the organisation
 * This will create a notification for the invited user
 */
export async function inviteMember(
  orgId: string,
  orgName: string,
  invitedUid: string,
  invitedByUid: string
) {
  try {
    // 1️⃣ Add the invited user to the org invites collection
    const inviteRef = await addDoc(collection(firestoreDb, "organisationInvites"), {
      orgId,
      orgName,
      invitedUid,
      invitedBy: invitedByUid,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    return inviteRef.id;
  } catch (err) {
    throw err;
  }
}