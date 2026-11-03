import '../../../app/hc.dart';
import '../../checkout/presentation/checkout_screen.dart';

const districts = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
];

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => PageFrame(
    title: context.tr('addresses.title'),
    child: Protected(
      child: ref
          .watch(addressesProvider)
          .when(
            skipLoadingOnRefresh: false,
            skipLoadingOnReload: false,
            loading: () => const LoadingBlocks(),
            error: (e, _) =>
                ErrorState(e, retry: () => ref.invalidate(addressesProvider)),
            data: (rows) => ListView(
              padding: const EdgeInsets.all(20),
              children: [
                FilledButton.icon(
                  onPressed: () async {
                    await context.push('/account/addresses/new');
                    ref.invalidate(addressesProvider);
                  },
                  icon: const Icon(Icons.add),
                  label: Text(context.tr('addresses.add')),
                ),
                verticalGap(20),
                if (rows.isEmpty)
                  EmptyState(
                    title: context.tr('addresses.emptyTitle'),
                    message: context.tr('addresses.emptyMessage'),
                    icon: Icons.location_on_outlined,
                  ),
                for (final row in rows)
                  Padding(
                    key: ValueKey('address-${row.id}'),
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Panel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            row.address.recipient,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          verticalGap(6),
                          AddressSummary(row),
                          const Divider(height: 20),
                          ResponsiveActions(
                            children: [
                              TextButton.icon(
                                key: ValueKey('address-edit-${row.id}'),
                                onPressed: () async {
                                  await context.push(
                                    '/account/addresses/${Uri.encodeComponent(row.id)}/edit',
                                  );
                                  ref.invalidate(addressesProvider);
                                },
                                icon: const Icon(Icons.edit_outlined),
                                label: Text(context.tr('addresses.edit')),
                              ),
                              if (!row.phoneVerified)
                                TextButton.icon(
                                  key: ValueKey('address-verify-${row.id}'),
                                  onPressed: () async {
                                    await context.push(
                                      '/account/phone?phone=${Uri.encodeQueryComponent(row.address.phone)}',
                                    );
                                    ref.invalidate(addressesProvider);
                                  },
                                  icon: const Icon(
                                    Icons.verified_user_outlined,
                                  ),
                                  label: Text(
                                    context.tr('addresses.verifyPhone'),
                                  ),
                                ),
                              if (!row.isDefault)
                                ActionButton(
                                  key: ValueKey('address-default-${row.id}'),
                                  label: context.tr('addresses.setDefault'),
                                  outlined: true,
                                  icon: Icons.home_outlined,
                                  action: () async {
                                    final done = context.tr(
                                      'addresses.defaultSet',
                                    );
                                    await ref.read(repositoryProvider).write(
                                      '/me/addresses/${row.id}',
                                      'PATCH',
                                      {'isDefault': true},
                                    );
                                    ref.invalidate(addressesProvider);
                                    if (context.mounted) toast(context, done);
                                  },
                                ),
                              ActionButton(
                                label: context.tr('addresses.remove'),
                                textOnly: true,
                                destructive: true,
                                action: () async {
                                  if (!await confirm(
                                    context,
                                    title: context.tr('addresses.removeTitle'),
                                    message: context.tr('addresses.removeBody'),
                                    action: context.tr(
                                      'addresses.removeConfirm',
                                    ),
                                  )) {
                                    return;
                                  }
                                  await ref
                                      .read(repositoryProvider)
                                      .write(
                                        '/me/addresses/${row.id}',
                                        'DELETE',
                                      );
                                  ref.invalidate(addressesProvider);
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
    ),
  );
}

/// Loads a saved address for `/account/addresses/:id/edit` (§4).
class EditAddressScreen extends ConsumerWidget {
  const EditAddressScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(addressesProvider)
      .when(
        skipLoadingOnRefresh: false,
        skipLoadingOnReload: false,
        loading: () => PageFrame(
          title: context.tr('addresses.editTitle'),
          child: const LoadingBlocks(),
        ),
        error: (e, _) => PageFrame(
          title: context.tr('addresses.editTitle'),
          child: ErrorState(e, retry: () => ref.invalidate(addressesProvider)),
        ),
        data: (rows) {
          final row = rows.where((a) => a.id == id).firstOrNull;
          if (row == null) {
            return PageFrame(
              title: context.tr('addresses.editTitle'),
              child: EmptyState(
                title: context.tr('addresses.notFound'),
                message: context.tr('addresses.emptyMessage'),
                icon: Icons.location_off_outlined,
              ),
            );
          }
          return AddAddressScreen(key: ValueKey(row.id), initial: row);
        },
      );
}

class AddAddressScreen extends ConsumerStatefulWidget {
  const AddAddressScreen({super.key, this.initial});

  /// Editing an existing address (PATCH) instead of creating one.
  final SavedAddress? initial;
  @override
  ConsumerState<AddAddressScreen> createState() => _AddAddressScreenState();
}

class _AddAddressScreenState extends ConsumerState<AddAddressScreen> {
  final form = GlobalKey<FormState>();
  final districtField = GlobalKey<FormFieldState<String>>();
  late final fields = {
    for (final k in [
      'recipient',
      'phone',
      'line1',
      'line2',
      'city',
      'postalCode',
    ])
      k: TextEditingController(text: initialValue(k)),
  };
  late String? district = widget.initial?.address.district;
  late bool makeDefault = widget.initial?.isDefault ?? false;

  String initialValue(String key) {
    final address = widget.initial?.address;
    if (address == null) return '';
    return switch (key) {
      'recipient' => address.recipient,
      'phone' => address.phone,
      'line1' => address.line1,
      'line2' => address.line2 ?? '',
      'city' => address.city,
      'postalCode' => address.postalCode,
      _ => '',
    };
  }

  @override
  void dispose() {
    for (final c in fields.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> selectDistrict() async {
    String q = '';
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, update) => SafeArea(
          child: SizedBox(
            height: MediaQuery.sizeOf(c).height * .8,
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                0,
                20,
                MediaQuery.viewInsetsOf(c).bottom,
              ),
              child: Column(
                children: [
                  TextField(
                    decoration: InputDecoration(
                      labelText: c.tr('addresses.searchDistricts'),
                      prefixIcon: const Icon(Icons.search),
                    ),
                    onChanged: (v) => update(() => q = v.toLowerCase()),
                  ),
                  verticalGap(),
                  Expanded(
                    child: ListView(
                      children: districts
                          .where((d) => d.toLowerCase().contains(q))
                          .map(
                            (d) => ListTile(
                              title: Text(d),
                              trailing: district == d
                                  ? const Icon(
                                      Icons.check,
                                      color: HelaColors.teal,
                                    )
                                  : null,
                              onTap: () => Navigator.pop(c, d),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    if (result != null && mounted) {
      setState(() => district = result);
      districtField.currentState?.didChange(result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.initial;
    return PageFrame(
      title: context.tr(
        editing == null ? 'addresses.addTitle' : 'addresses.editTitle',
      ),
      child: Protected(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final pair in [
                    ('recipient', 'addresses.recipient'),
                    ('phone', 'addresses.phone'),
                    ('line1', 'addresses.line1'),
                    ('line2', 'addresses.line2'),
                    ('city', 'addresses.city'),
                    ('postalCode', 'addresses.postalCode'),
                  ]) ...[
                    TextFormField(
                      controller: fields[pair.$1],
                      keyboardType: pair.$1 == 'phone'
                          ? TextInputType.phone
                          : pair.$1 == 'postalCode'
                          ? TextInputType.text
                          : pair.$1 == 'recipient'
                          ? TextInputType.name
                          : TextInputType.streetAddress,
                      textInputAction: TextInputAction.next,
                      textCapitalization:
                          pair.$1 == 'phone' || pair.$1 == 'postalCode'
                          ? TextCapitalization.none
                          : TextCapitalization.words,
                      decoration: InputDecoration(
                        labelText: context.tr(pair.$2),
                        helperText: pair.$1 == 'phone' && editing != null
                            ? context.tr('addresses.phoneChangeNote')
                            : null,
                        helperMaxLines: 4,
                      ),
                      validator: (v) {
                        if (pair.$1 == 'line2') {
                          return v != null && v.length > 200
                              ? AppStrings.current.t('validation.maxChars', {
                                  'max': 200,
                                })
                              : null;
                        }
                        if (pair.$1 == 'phone') {
                          return v != null &&
                                  RegExp(r'^\+?[0-9 ()-]{9,20}$')
                                      .hasMatch(v.trim())
                              ? null
                              : AppStrings.current.t('addresses.phoneInvalid');
                        }
                        return requiredText(
                          v,
                          min: pair.$1 == 'line1'
                              ? 5
                              : pair.$1 == 'postalCode'
                              ? 3
                              : 2,
                          max: pair.$1 == 'recipient'
                              ? 100
                              : pair.$1 == 'city'
                              ? 80
                              : pair.$1 == 'postalCode'
                              ? 20
                              : 200,
                        );
                      },
                    ),
                    verticalGap(),
                  ],
                  FormField<String>(
                    key: districtField,
                    initialValue: district,
                    validator: (value) => value == null
                        ? context.tr('addresses.districtRequired')
                        : null,
                    builder: (field) => Semantics(
                      button: true,
                      child: InkWell(
                        key: const ValueKey('address-district'),
                        onTap: selectDistrict,
                        borderRadius: BorderRadius.circular(12),
                        child: InputDecorator(
                          isEmpty: district == null,
                          decoration: InputDecoration(
                            labelText: context.tr('addresses.chooseDistrict'),
                            errorText: field.errorText,
                            prefixIcon: const Icon(
                              Icons.location_on_outlined,
                              size: 20,
                            ),
                            suffixIcon: const Icon(Icons.expand_more, size: 20),
                          ),
                          child: Text(district ?? ''),
                        ),
                      ),
                    ),
                  ),
                  CheckboxListTile(
                    key: const ValueKey('address-make-default'),
                    contentPadding: EdgeInsets.zero,
                    value: makeDefault,
                    onChanged: editing?.isDefault == true
                        ? null
                        : (v) => setState(() => makeDefault = v ?? false),
                    title: Text(context.tr('addresses.makeDefault')),
                  ),
                  verticalGap(12),
                  ActionButton(
                    label: context.tr('addresses.save'),
                    action: () async {
                      if (!form.currentState!.validate()) return;
                      if (district == null) {
                        throw AppFailure(
                          AppStrings.current.t('addresses.districtRequired'),
                        );
                      }
                      final values = <String, dynamic>{
                        for (final e in fields.entries)
                          if (e.key != 'line2' ||
                              e.value.text.trim().isNotEmpty)
                            e.key: e.value.text.trim(),
                        'district': district,
                      };
                      final repository = ref.read(repositoryProvider);
                      Json result;
                      if (editing == null) {
                        // The API makes a buyer's first address the default.
                        result = object(
                          await repository.write('/me/addresses', 'POST', {
                            ...values,
                            if (makeDefault) 'isDefault': true,
                          }),
                        );
                      } else {
                        // §4: send only changed fields (plus isDefault).
                        final before = editing.address;
                        final original = <String, String?>{
                          'recipient': before.recipient,
                          'phone': before.phone,
                          'line1': before.line1,
                          'line2': before.line2,
                          'city': before.city,
                          'postalCode': before.postalCode,
                          'district': before.district,
                        };
                        final changes = <String, dynamic>{
                          for (final entry in values.entries)
                            if (entry.value != original[entry.key])
                              entry.key: entry.value,
                          // `line2: null` clears the optional second line.
                          if (before.line2?.isNotEmpty == true &&
                              fields['line2']!.text.trim().isEmpty)
                            'line2': null,
                          if (makeDefault && !editing.isDefault)
                            'isDefault': true,
                        };
                        result = changes.isEmpty
                            ? {'id': editing.id}
                            : object(
                                await repository.write(
                                  '/me/addresses/${editing.id}',
                                  'PATCH',
                                  changes,
                                ),
                              );
                      }
                      ref.invalidate(addressesProvider);
                      if (context.mounted) {
                        context.pop(string(result['id'], editing?.id ?? ''));
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
