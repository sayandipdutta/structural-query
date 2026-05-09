import { Schema, InferSchemaType, model, connect, disconnect } from "mongoose";


const resourceKinds = ["user", "group", "organization", "project"] as const;
const permissionValues = ["read", "write", "delete"] as const;

export type ResourceKind = (typeof resourceKinds)[number];
export type Permission = (typeof permissionValues)[number];

const ResourceSchema = new Schema(
    {
        id: { type: String, index: true, required: true, unique: true },
        name: { type: String, required: true },
    },
    {
        id: false,
        discriminatorKey: "resourceType",
        collection: "resouce",
    },
);

// type ResourceBase = InferSchemaType<typeof ResourceSchema> & { resourceType: ResourceKind };

export const ResourceModel = model<InferSchemaType<typeof ResourceSchema>>("Resource", ResourceSchema);

const UserSchema = new Schema({ email: { type: String, required: true } });
const GroupSchema = new Schema({ alias: { type: String } });
const ProjectSchema = new Schema({ description: { type: String } });
const OrganizationSchema = new Schema({ plan: { type: String, enum: ["free", "pro", "enterprise"], required: true } });

type UserResource = InferSchemaType<typeof ResourceSchema> & InferSchemaType<typeof UserSchema> & { resourceType: "user" };
type GroupResource = InferSchemaType<typeof ResourceSchema> & InferSchemaType<typeof GroupSchema> & { resourceType: "group" };
type ProjectResource = InferSchemaType<typeof ResourceSchema> & InferSchemaType<typeof ProjectSchema> & { resourceType: "project" };
type OrganizationResource = InferSchemaType<typeof ResourceSchema> & InferSchemaType<typeof OrganizationSchema> & { resourceType: "organization" };

type Resource =
    | UserResource
    | GroupResource
    | ProjectResource
    | OrganizationResource;

export const UserModel = ResourceModel.discriminator<UserResource>("UserModel", UserSchema, "user");
export const GroupModel = ResourceModel.discriminator<GroupResource>("GroupModel", GroupSchema, "group");
export const ProjectModel = ResourceModel.discriminator<ProjectResource>("ProjectModel", ProjectSchema, "project");
export const OrganizationModel = ResourceModel.discriminator<OrganizationResource>("OrganizationModel", OrganizationSchema, "organization");

const ResourceRefSchema = new Schema(
    {
        id: { type: String, required: true },
        resourceType: { type: String, enum: resourceKinds, required: true },
    }, { _id: false }
);

const ResourcePermissionSchema = new Schema(
    {
        sourceResource: { type: ResourceRefSchema, required: true },
        permissions: {
            type: [{ type: String, enum: permissionValues }],
            required: true,
            valiidator: {
                validate: (permissions: Permission[]) => permissions.length > 0,
                message: "At least one permission is required",
            },
        },
        targetResource: { type: ResourceRefSchema, required: true },
    },
    { collection: "resource_permissions", timestamps: true }
);

ResourcePermissionSchema.index({ "sourceResource.id": 1 });
ResourcePermissionSchema.index({ "sourceResource.id": 1, "targetResource.id": 1 });
ResourcePermissionSchema.index({ "targetResource.id": 1, "sourceResource.id": 1 });
ResourcePermissionSchema.index(
    {
        "sourceResource.id": 1,
        "sourceResource.resourceType": 1,
        "targetResource.id": 1,
        "targetResource.resourceType": 1,
    }, { unique: true }
);
ResourcePermissionSchema.virtual("sourceDoc", {
    ref: "Resource",
    localField: "sourceResource.id",
    foreignField: "id",
    justOne: true,
})
ResourcePermissionSchema.virtual("targetDoc", {
    ref: "Resource",
    localField: "targetResource.id",
    foreignField: "id",
    justOne: true,
})
ResourcePermissionSchema.set('toObject', { virtuals: true });


export type ResourceRef = InferSchemaType<typeof ResourceRefSchema>;
type ResourcePermissionBase = InferSchemaType<typeof ResourcePermissionSchema>;
export type ResourcePermission = ResourcePermissionBase & { sourceDoc?: Resource, targetDoc?: Resource };

export const ResourcePermissionModel = model<ResourcePermission>("ResourcePermissions", ResourcePermissionSchema);

async function reSourceResource() {
    await ResourceModel.deleteMany({});
    await ResourcePermissionModel.deleteMany({});

    await UserModel.create({ id: "user-subsaha", name: "Subhendu Saha", email: "subsaha2000@gmail.com" })
    await GroupModel.create({ id: "group-ml", name: "Machine Learning", alias: "ai" })
    await ProjectModel.create({ id: "project-chc", name: "Calcutta High Court", description: "Digitization Project" })
    await OrganizationModel.create({ id: "org-nevaeh", name: "Nevaeh", plan: "free" })

    await ResourcePermissionModel.create([
        {
            sourceResource: { id: "user-subsaha", resourceType: "user" },
            permissions: ["read", "write"],
            targetResource: { id: "project-chc", resourceType: "project" },
        },
        {
            sourceResource: { id: "user-subsaha", resourceType: "user" },
            permissions: ["write"],
            targetResource: { id: "group-ml", resourceType: "group" },
        },
        {
            sourceResource: { id: "group-ml", resourceType: "group" },
            permissions: ["read"],
            targetResource: { id: "org-nevaeh", resourceType: "organization" },
        },
        {
            sourceResource: { id: "user-subsaha", resourceType: "user" },
            permissions: ["read", "write"],
            targetResource: { id: "org-nevaeh", resourceType: "organization" },
        },
    ]);
}

async function describeRelationship() {
    const ids = ["user-subsaha", "project-chc", "group-ml", "org-nevaeh"];

    for (const id of ids) {
        const relations = await ResourcePermissionModel.find({
            "$or": [{ "sourceResource.id": id }, { "targetResource.id": id }]
        })
            .populate("sourceDoc")
            .populate("targetDoc")
            .lean<ResourcePermission[]>();

        const outgoingRelations = relations.filter(rel => rel.sourceDoc?.id === id);
        const incomingRelations = relations.filter(rel => rel.targetDoc?.id === id);

        console.group(`outgoing relationships for id=${id}`)
        if (outgoingRelations.length === 0) {
            console.log(`No outgoing relationships found!`);
        } else {
            for (const orel of outgoingRelations) {
                console.log(`${orel.sourceResource.resourceType}(${orel.sourceDoc?.name ?? orel.sourceResource.id}) can [${orel.permissions}] to ${orel.targetResource.resourceType}(${orel.targetDoc?.name ?? orel.targetResource.id})`);
            }
        }
        console.groupEnd()
        console.log();
        console.group(`incoming relationships for id=${id}`)
        if (incomingRelations.length === 0) {
            console.log(`No incoming relationships found!`);
        } else {
            for (const irel of incomingRelations) {
                console.log(`${irel.sourceResource.resourceType}(${irel.sourceDoc?.name ?? irel.sourceResource.id}) can [${irel.permissions}] to ${irel.targetResource.resourceType}(${irel.targetDoc?.name ?? irel.targetResource.id})`);
            }
        }
        console.groupEnd()
        console.log("--------");
    }
}

export async function runExample() {
    const connectionString = process.env.MONGO_URI || "mongodb://localhost:27017/resource-relations";
    await connect(connectionString);
    await reSourceResource();

    await describeRelationship();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runExample()
        .catch((error) => {
            console.error(error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await disconnect();
        });
}
