export const GOOGLE_FORM_MAPPING = {
    // All entry IDs verified from pre-filled link on 2026-02-12
    TEXT_FIELDS: {
        // Personal Details
        '7debf274-baee-4bac-a137-4b4b46719874': { entryId: '91380005', title: 'Name' },
        'eb3617dc-9f1d-475d-a2db-005b6bc2500c': { entryId: '369051239', title: 'Contact Number' },
        '5df6fa40-c39f-41a7-9ee7-789a47435ef0': { entryId: '1825163746', title: 'Gender' },
        '6e570a01-14e0-4e18-b112-97ddc51d0778': { entryId: '1212604587', title: 'Date of Birth' },
        '2fdacb1b-254f-4fc3-923a-53233214124f': { entryId: '162245115', title: 'Citizenship' },
        '2f8c72f5-10f4-4414-bfcd-274fc69592e2': { entryId: '1498268742', title: 'Blood Group' },
        '5ae316e6-2941-4e58-93b8-a6fe5a200e98': { entryId: '496684028', title: 'Height' },
        '7386dcfa-e693-4998-a1cb-35a8fa8029de': { entryId: '794305909', title: 'Identity Marks' },
        'c53d7ba7-58a0-4cf0-8691-8eb7bef7b951': { entryId: '912886836', title: 'Marital Status' },
        '7db47bc3-e4cc-4984-9687-2d94cad3e632': { entryId: '24675791', title: 'Spouse Name' },

        // Job Details
        '61b19d37-b860-44ef-80e9-d33c3b438655': { entryId: '553065512', title: 'Qualification' },
        'db307195-cf54-4a6e-9056-f3974b050c4d': { entryId: '1391743189', title: 'Post of Apply' },
        '52ae217b-2602-4337-a1cd-a1f9bd36a4b0': { entryId: '182192468', title: 'Unit or Facility' },
        '0c8a587e-08f3-4605-ad33-9ab34eb46d87': { entryId: '1501967284', title: 'Any Police Case' },
        '4b05d2b6-ff73-4dbe-befa-eba77c8ce1c4': { entryId: '1791888070', title: 'Previous Employment History' },
        'd16a6da1-fc29-405e-bbb6-cb186b8f8666': { entryId: '302669766', title: 'Previous Company & Experience' },

        // Address
        '8532f460-7bcf-4831-ab62-96375b80e6ab': { entryId: '1259493972', title: 'Present Address' },
        '29bae22a-59db-4b1b-bafd-64e8018a0f4e': { entryId: '364537610', title: 'Permanent Address' },

        // Reference
        '2e1f27bf-94e7-421f-b69c-7e8dfaf0ee13': { entryId: '90941984', title: 'Reference Name' },
        '13c82880-161a-4fa9-a8b6-0558d5c88c53': { entryId: '397794908', title: 'Reference Relationship' },
        '7681644c-02f8-4034-b0ce-cc11dfd3dca7': { entryId: '264335202', title: 'Reference Address' },
        'e1479d43-ed04-4fde-a508-130f43b4f12d': { entryId: '1214057', title: 'Reference Contact No' },

        // Family Details
        '3f09e364-7875-40a2-9490-41251be20366': { entryId: '1936747099', title: 'Father Name' },
        'c432a45e-c1f0-4e64-8002-1f1dba3bf660': { entryId: '33163074', title: 'Mother Name' },
        '30d78dae-fb7c-4264-a159-c04993d8885c': { entryId: '312313331', title: 'Father Mobile Number' },
        '30fab2de-452d-46bf-8079-2f53d322388d': { entryId: '306848814', title: 'Mother Mobile Number' },

        // Government Identifications
        '18855ee9-0d66-41d6-988b-128b776a8c5b': { entryId: '1313287059', title: 'Aadhar Card No' },
        'da8edb18-4bed-41ca-8233-2280b97dac8d': { entryId: '2063837277', title: 'PAN Card No' },
        'f6665f3e-98f4-4d92-8b53-adcaa1993bbe': { entryId: '1816344224', title: 'UAN No or EPFO' },
        '41e3505e-15fb-4067-9c6a-2c690e736fab': { entryId: '2059296290', title: 'ESI No' },
        '1052957c-a885-494e-af2c-ae1af5c5cc8e': { entryId: '1979558022', title: 'PVC (Police Verification Certificate)' },
        '791bdd86-20c2-4097-bcc1-c85e8f649961': { entryId: '843490446', title: 'PVC Number (If YES)' },

        // Bank Details
        '1a35eaa7-d302-4e49-8649-e85cab8b3b77': { entryId: '1813836101', title: 'Bank Name' },
        '3519c111-aaa6-4fe0-8d83-d03dd7612e28': { entryId: '696312381', title: 'Account No' },
        '86854000-7727-40bb-9932-09e28e443ad8': { entryId: '228169169', title: 'IFSC Code' },
        '6fe166fc-29a3-41ea-a19f-a498b48089b9': { entryId: '1253822805', title: 'Branch Name' }
    },

    // File fields (now text fields in Google Form - will receive Drive URLs)
    FILE_FIELDS: {
        'eecc5044-399c-45f8-aa03-e609748f0e49': { entryId: '1289730650', title: 'Aadhar Card  (Front)' },
        'c95cb7c0-9aab-48f8-b4e3-1bafc7678147': { entryId: '1582940126', title: 'Aadhar Card  (Back)' },
        'd4116a1b-aa88-438c-8cfb-78b2bf6dc2be': { entryId: '1024109366', title: 'PAN  Card' },
        '3f394f92-e214-4122-a9cc-056150bc2fe5': { entryId: '1470580390', title: 'Bank Passbook or Cheque' },
        '109e619f-f27b-45f3-812e-bac4be76de11': { entryId: '18820690', title: 'SSC - 10th, INTER, DEGREE MEMO' },
        '7fbd2b8f-62b5-402d-a1dd-262531fa80af': { entryId: '790469887', title: 'Photo' },
        '03370580-48a7-4748-b74e-80cd5f6cef0a': { entryId: '824044642', title: 'PVC' },
        '46b67cdf-7ae8-4b7a-977d-d838fdcc577d': { entryId: '1393403122', title: 'Electricity Bill' }
    }
};

