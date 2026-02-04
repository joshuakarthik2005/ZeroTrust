/**
 * One-time script to update existing documents that don't have organizationId/workspaceId
 * Run this with: node fix-existing-documents.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('./models/index').Document;
const User = require('./models/index').User;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zero-trust-workspace';

async function fixDocuments() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all documents without organizationId or workspaceId
        const documents = await Document.find({
            $or: [
                { organizationId: null },
                { workspaceId: null },
                { organizationId: { $exists: false } },
                { workspaceId: { $exists: false } }
            ]
        });

        console.log(`Found ${documents.length} documents without org/workspace`);

        for (const doc of documents) {
            // Get the owner
            const owner = await User.findById(doc.ownerId);
            
            if (owner && owner.currentOrganizationId && owner.currentWorkspaceId) {
                // Update with owner's current org/workspace
                doc.organizationId = owner.currentOrganizationId;
                doc.workspaceId = owner.currentWorkspaceId;
                await doc.save();
                console.log(`Updated document "${doc.title}" with org: ${owner.currentOrganizationId}, workspace: ${owner.currentWorkspaceId}`);
            } else {
                console.log(`Skipping document "${doc.title}" - owner has no current org/workspace`);
            }
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixDocuments();
